import { Module } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup'
import { AdminModule } from './admin/admin.module'
import { AuthModule } from './auth/auth.module'
import { BillingModule } from './billing/billing.module'
import { ChatModule } from './chat/chat.module'
import { CheckinModule } from './checkin/checkin.module'
import { ConsentModule } from './consent/consent.module'
import { EventsModule } from './events/events.module'
import { ExploreModule } from './explore/explore.module'
import { GamesModule } from './games/games.module'
import { HealthModule } from './health/health.module'
import { JobsModule } from './jobs/jobs.module'
import { MailModule } from './mail/mail.module'
import { ModerationModule } from './moderation/moderation.module'
import { PlayIntentsModule } from './play-intents/play-intents.module'
import { PrismaModule } from './prisma/prisma.module'
import { PushModule } from './push/push.module'
import { RealtimeModule } from './realtime/realtime.module'
import { RoomsModule } from './rooms/rooms.module'
import { StorageModule } from './storage/storage.module'
import { UsersModule } from './users/users.module'
import { VenuesModule } from './venues/venues.module'
import { WaitlistModule } from './waitlist/waitlist.module'

@Module({
  imports: [
    SentryModule.forRoot(),
    PrismaModule,
    JobsModule,
    MailModule,
    StorageModule,
    PushModule,
    PlayIntentsModule,
    RealtimeModule,
    AuthModule,
    HealthModule,
    GamesModule,
    UsersModule,
    ConsentModule,
    ExploreModule,
    VenuesModule,
    EventsModule,
    WaitlistModule,
    ModerationModule,
    RoomsModule,
    AdminModule,
    ChatModule,
    CheckinModule,
    BillingModule,
  ],
  // Erreurs inattendues (pas les HttpException voulues : 400, 404…) envoyées à GlitchTip (LKO-36)
  providers: [{ provide: APP_FILTER, useClass: SentryGlobalFilter }],
})
export class AppModule {}
