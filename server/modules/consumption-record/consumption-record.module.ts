import { Module } from '@nestjs/common';
import { ConsumptionRecordController } from './consumption-record.controller';
import { ConsumptionRecordService } from './consumption-record.service';

@Module({
  controllers: [ConsumptionRecordController],
  providers: [ConsumptionRecordService],
})
export class ConsumptionRecordModule {}
