import { get } from '@vercel/edge-config';

export type EverrediFlags = {
  maintenanceMode: boolean;
  signupEnabled: boolean;
  alertsDispatch: 'sync' | 'queue' | 'workflow';
};

const defaults: EverrediFlags = {
  maintenanceMode: false,
  signupEnabled: true,
  alertsDispatch: 'sync',
};

export async function getFlags(): Promise<EverrediFlags> {
  if (!process.env.EDGE_CONFIG) {
    return defaults;
  }
  try {
    const [maintenanceMode, signupEnabled, alertsDispatch] = await Promise.all([
      get<boolean>('maintenanceMode'),
      get<boolean>('signupEnabled'),
      get<'sync' | 'queue' | 'workflow'>('alertsDispatch'),
    ]);
    return {
      maintenanceMode: maintenanceMode ?? defaults.maintenanceMode,
      signupEnabled: signupEnabled ?? defaults.signupEnabled,
      alertsDispatch: alertsDispatch ?? defaults.alertsDispatch,
    };
  } catch {
    return defaults;
  }
}
