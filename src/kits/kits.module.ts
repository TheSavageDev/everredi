import { Module, forwardRef } from '@nestjs/common';
import {
  KitsController,
  UserKitsController,
  PublicTemplatesController,
} from './kits.controller';
import { KitTemplatesService } from './kit-templates.service';
import { UserKitsService } from './user-kits.service';
import { PublicTemplatesService } from './public-templates.service';
import { TemplateSeedService } from './template-seed.service';
import { SuppliesModule } from '../supplies/supplies.module';
import { SupplyCategoriesModule } from '../supply-categories/supply-categories.module';
import { InventoryModule } from '../inventory/inventory.module';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';
import { ComplianceModule } from '../compliance/compliance.module';

@Module({
  imports: [
    SuppliesModule,
    SupplyCategoriesModule,
    forwardRef(() => InventoryModule),
    UsersModule,
    TenantsModule,
    forwardRef(() => ComplianceModule),
  ],
  controllers: [KitsController, UserKitsController, PublicTemplatesController],
  providers: [
    KitTemplatesService,
    UserKitsService,
    PublicTemplatesService,
    TemplateSeedService,
  ],
  exports: [
    KitTemplatesService,
    UserKitsService,
    PublicTemplatesService,
    TemplateSeedService,
  ],
})
export class KitsModule {}
