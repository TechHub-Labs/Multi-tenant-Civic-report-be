import { Controller, Get, Redirect, HttpCode } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  @Redirect('/api/docs', 302)
  getHello() {}

  @Get('favicon.ico')
  @HttpCode(204)
  getFavicon() {}
}
