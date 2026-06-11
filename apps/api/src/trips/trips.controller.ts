import {
  Body, Controller, Get, NotFoundException, Param, Post,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateTripDto } from './dto/create-trip.dto';
import { TripsService } from './trips.service';

@ApiTags('trips')
@Controller('trips')
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Post()
  @ApiOkResponse({ description: 'Store a trip log (requires logging consent).' })
  create(@Body() body: CreateTripDto) {
    return this.trips.create(body);
  }

  @Get()
  @ApiOkResponse({ description: 'List stored trips (pilot/admin use).' })
  async findAll() {
    return { count: await this.trips.count(), trips: await this.trips.findAll() };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const trip = await this.trips.findById(id);
    if (!trip) throw new NotFoundException(`Trip ${id} not found`);
    return trip;
  }
}
