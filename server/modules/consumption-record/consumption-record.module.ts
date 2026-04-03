import { Module } from '@nestjs/common';
import { ConsumptionRecordController } from './consumption-record.controller';
import { ConsumptionRecordService } from './consumption-record.service';
import { ConsumptionRecordAutomationService } from './consumption-record.automation';

@Module({
  controllers: [ConsumptionRecordController],
  providers: [ConsumptionRecordService, ConsumptionRecordAutomationService],
})
export class ConsumptionRecordModule {}
