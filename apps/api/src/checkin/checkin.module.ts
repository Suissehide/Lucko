import { Module } from '@nestjs/common'
import { BillingModule } from '../billing/billing.module'
import { CheckinController } from './checkin.controller'
import { CheckinService } from './checkin.service'

@Module({
  imports: [BillingModule],
  controllers: [CheckinController],
  providers: [CheckinService],
})
export class CheckinModule {}
