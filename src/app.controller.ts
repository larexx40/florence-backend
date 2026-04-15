import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { SkipApiKey } from './common/decorators/skip-api-key.decorator';

@ApiTags('health')
@SkipApiKey()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  hello() {
    return this.appService.healthCheck();
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  healthCheck() {
    return this.appService.healthCheck();
  }
}
