import { Module } from '@nestjs/common'
import { EventsController } from './events.controller'
import { EventsService } from './events.service'
import { VenueEventsController } from './venue-events.controller'
import { VenueEventsService } from './venue-events.service'

@Module({
  controllers: [EventsController, VenueEventsController],
  providers: [EventsService, VenueEventsService],
  exports: [VenueEventsService],
})
export class EventsModule {}
