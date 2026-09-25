import { Module } from '@nestjs/common';
import { AdminTokenGuard } from '../common/admin-token.guard.js';
import { AdminController } from './admin.controller.js';
import { AdminRepository } from './admin.repository.js';
import { AdminService } from './admin.service.js';
import { DemoDataRepository } from './demo-data.repository.js';

@Module({
  controllers: [AdminController],
  providers: [AdminRepository, AdminService, DemoDataRepository, AdminTokenGuard],
})
export class AdminModule {}
