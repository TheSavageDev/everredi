import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudTasksClient } from '@google-cloud/tasks';

const logger = new Logger('CloudTasksService');

export interface ExpirationTaskPayload {
  itemId: string;
  userId: string;
  expirationDate: string;
  daysUntilExpiration: number; // 60, 30, 10, or 1
  notificationType: 'expiration_warning';
}

@Injectable()
export class CloudTasksService {
  private client: CloudTasksClient;
  private projectId: string;
  private location: string;
  private queueName: string;
  private baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new CloudTasksClient();
    this.projectId =
      this.configService.get<string>('GOOGLE_CLOUD_PROJECT_ID') ||
      'everredi-dev';
    this.location =
      this.configService.get<string>('GOOGLE_CLOUD_LOCATION') || 'us-central1';
    this.queueName =
      this.configService.get<string>('CLOUD_TASKS_QUEUE_NAME') ||
      'expiration-notifications';
    this.baseUrl =
      this.configService.get<string>('API_BASE_URL') ||
      this.configService.get<string>('CLOUD_TASKS_BASE_URL') ||
      'https://api.everredi.com';
  }

  /**
   * Get the full queue path
   */
  private getQueuePath(): string {
    return this.client.queuePath(this.projectId, this.location, this.queueName);
  }

  /**
   * Create Cloud Tasks for expiration alerts (60, 30, 10, 1 days before expiration)
   */
  async createExpirationTasks(
    itemId: string,
    expirationDate: Date,
    userId: string,
  ): Promise<string[]> {
    const taskIds: string[] = [];
    const alertDays = [60, 30, 10, 1]; // Days before expiration to send alerts

    for (const days of alertDays) {
      try {
        const alertDate = new Date(expirationDate);
        alertDate.setDate(alertDate.getDate() - days);

        // Skip if alert date is in the past
        if (alertDate < new Date()) {
          logger.warn(
            `Skipping ${days}-day alert for item ${itemId} - alert date is in the past`,
          );
          continue;
        }

        const payload: ExpirationTaskPayload = {
          itemId,
          userId,
          expirationDate: expirationDate.toISOString(),
          daysUntilExpiration: days,
          notificationType: 'expiration_warning',
        };

        const task = {
          httpRequest: {
            httpMethod: 'POST' as const,
            url: `${this.baseUrl}/api/notifications/expiration`,
            headers: {
              'Content-Type': 'application/json',
            },
            body: Buffer.from(JSON.stringify(payload)).toString('base64'),
          },
          scheduleTime: {
            seconds: Math.floor(alertDate.getTime() / 1000),
          },
        };

        const [response] = await this.client.createTask({
          parent: this.getQueuePath(),
          task,
        });

        if (response.name) {
          // Extract task ID from the full name (projects/.../locations/.../queues/.../tasks/TASK_ID)
          const taskId = response.name.split('/').pop() || '';
          taskIds.push(taskId);
          logger.log(
            `Created ${days}-day expiration task ${taskId} for item ${itemId} scheduled for ${alertDate.toISOString()}`,
          );
        }
      } catch (error: unknown) {
        // Handle permission errors more gracefully (common in development)
        const err = error as { code?: number; message?: string };
        if (err?.code === 7) {
          // PERMISSION_DENIED - likely missing IAM permissions or queue doesn't exist
          logger.warn(
            `Cloud Tasks permission denied for ${days}-day expiration task (item ${itemId}). ` +
              `This is expected in development if Cloud Tasks is not configured. ` +
              `Queue: ${this.queueName}, Project: ${this.projectId}`,
          );
        } else if (err?.code === 5) {
          // NOT_FOUND - queue doesn't exist
          logger.warn(
            `Cloud Tasks queue not found: ${this.queueName} (item ${itemId}). ` +
              `Queue may need to be created in project ${this.projectId}`,
          );
        } else {
          // Other errors - log full details
          logger.error(
            `Error creating ${days}-day expiration task for item ${itemId}:`,
            error,
          );
        }
        // Continue with other tasks even if one fails
      }
    }

    return taskIds;
  }

  /**
   * Cancel existing Cloud Tasks
   */
  async cancelExpirationTasks(taskIds: string[]): Promise<void> {
    if (!taskIds || taskIds.length === 0) {
      return;
    }

    for (const taskId of taskIds) {
      try {
        const taskPath: string = this.client.taskPath(
          this.projectId,
          this.location,
          this.queueName,
          taskId,
        );
        await this.client.deleteTask({ name: taskPath });
        logger.log(`Deleted expiration task ${taskId}`);
      } catch (error: unknown) {
        // Task might not exist (already executed or deleted), log but don't throw
        const err = error as { code?: number; message?: string };
        if (err?.code === 5) {
          // NOT_FOUND - task doesn't exist
          logger.warn(
            `Task ${taskId} not found, may have already been executed or deleted`,
          );
        } else if (err?.code === 7) {
          // PERMISSION_DENIED - likely missing IAM permissions
          logger.warn(
            `Cloud Tasks permission denied when deleting task ${taskId}. ` +
              `This is expected in development if Cloud Tasks is not configured.`,
          );
        } else {
          logger.error(`Error deleting task ${taskId}:`, error);
        }
      }
    }
  }

  /**
   * Update expiration tasks - cancel old ones and create new ones
   */
  async updateExpirationTasks(
    itemId: string,
    oldTaskIds: string[],
    newExpirationDate: Date,
    userId: string,
  ): Promise<string[]> {
    // Cancel old tasks
    if (oldTaskIds && oldTaskIds.length > 0) {
      await this.cancelExpirationTasks(oldTaskIds);
    }

    // Create new tasks
    return await this.createExpirationTasks(itemId, newExpirationDate, userId);
  }
}
