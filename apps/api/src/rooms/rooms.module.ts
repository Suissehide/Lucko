import { Module } from '@nestjs/common'
import { BillingModule } from '../billing/billing.module'
import { AttendanceController } from './attendance.controller'
import { AttendanceService } from './attendance.service'
import { RoomsController } from './rooms.controller'
import { RoomsService } from './rooms.service'

@Module({
  imports: [BillingModule],
  controllers: [RoomsController, AttendanceController],
  providers: [RoomsService, AttendanceService],
})
export class RoomsModule {}
