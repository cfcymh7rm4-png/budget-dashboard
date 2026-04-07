import { APP_FILTER } from '@nestjs/core';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PlatformModule } from '@lark-apaas/fullstack-nestjs-core';

import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { StaticMiddleware } from './common/middleware/static.middleware';
import { ViewModule } from './modules/view/view.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ConsumptionRecordModule } from './modules/consumption-record/consumption-record.module';
import { BudgetModule } from './modules/budget/budget.module';

@Module({
  imports: [
    // 平台 Module，提供平台能力
    PlatformModule.forRoot(),
    // ====== @route-section: business-modules START ======
    // Place all business modules here.Do NOT add fallback modules here.
    DashboardModule,
    ConsumptionRecordModule,
    BudgetModule,
    // ====== @route-section: business-modules END ======

    // ⚠️ @route-order: last
    // ViewModule is the fallback route module, must be registered last.
    ViewModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(StaticMiddleware).forRoutes('*');
  }
}
