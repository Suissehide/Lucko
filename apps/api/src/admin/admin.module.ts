import { Module } from '@nestjs/common'
import { EventsModule } from '../events/events.module'
import { AuditInterceptor } from './admin.decorators'
import { AdminService } from './admin.service'
import { AdminCatalogController } from './admin-catalog.controller'
import { AdminFeedbackController } from './admin-feedback.controller'
import { AdminModerationController } from './admin-moderation.controller'
import { AdminWaitlistController } from './admin-waitlist.controller'

/** Back-office de l'équipe Lucko (LKO-20) : routes /admin/*, réservées au rôle ADMIN. */
@Module({
  imports: [EventsModule],
  controllers: [
    AdminModerationController,
    AdminCatalogController,
    AdminWaitlistController,
    AdminFeedbackController,
  ],
  providers: [AdminService, AuditInterceptor],
})
export class AdminModule {}
