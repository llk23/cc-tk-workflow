import { Controller, Get, Param } from '@nestjs/common';
import { VideoService } from './video.service';

@Controller('api/videos')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Get()
  async list() {
    return this.videoService.findAll();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.videoService.findOne(id);
  }
}
