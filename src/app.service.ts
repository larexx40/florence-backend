import { Injectable } from '@nestjs/common';
import { time } from 'console';

@Injectable()
export class AppService {
  healthCheck() {
    return {
      status: true,
      message: "Welcome to Florence API",
      time: new Date().toISOString(),
      data: null
    };
  }
}
