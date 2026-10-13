import { Module } from '@nestjs/common'
import { BillingModule } from '../billing/billing.module'
import { XpModule } from '../xp/xp.module'
import { AttendanceController } from './attendance.controller'
import { AttendanceService } from './attendance.service'
import { ResultsController } from './results.controller'
import { ResultsService } from './results.service'
import { RoomsController } from './rooms.controller'
import { RoomsService } from './rooms.service'

@Module({
  imports: [BillingModule, XpModule],
  controllers: [RoomsController, AttendanceController, ResultsController],
  providers: [RoomsService, AttendanceService, ResultsService],
})
export class RoomsModule {}
