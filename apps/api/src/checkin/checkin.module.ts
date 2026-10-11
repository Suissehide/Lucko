import { Module } from '@nestjs/common'
import { BillingModule } from '../billing/billing.module'
import { XpModule } from '../xp/xp.module'
import { CheckinController } from './checkin.controller'
import { CheckinService } from './checkin.service'

@Module({
  imports: [BillingModule, XpModule],
  controllers: [CheckinController],
  providers: [CheckinService],
})
export class CheckinModule {}
