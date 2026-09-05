import {
  Body, Controller, Get, NotFoundException, Param, Post, UseGuards,
} from '@nestjs/common';
import { ApiForbiddenResponse, ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from './admin.guard';
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

  /**
   * Bulk read of every stored trip. Admin-only: the payload contains other
   * riders' origins and destinations, so it is guarded and disabled unless
   * ADMIN_TOKEN is configured.
   */
  @Get()
  @UseGuards(AdminGuard)
  @ApiHeader({ name: 'x-admin-token', required: true, description: 'Must match ADMIN_TOKEN.' })
  @ApiOkResponse({ description: 'List stored trips (admin only).' })
  @ApiForbiddenResponse({ description: 'Missing/invalid token, or ADMIN_TOKEN unset.' })
  async findAll() {
    return { count: await this.trips.count(), trips: await this.trips.findAll() };
  }

  @Get(':id')
  @UseGuards(AdminGuard)
  @ApiHeader({ name: 'x-admin-token', required: true, description: 'Must match ADMIN_TOKEN.' })
  @ApiForbiddenResponse({ description: 'Missing/invalid token, or ADMIN_TOKEN unset.' })
  async findById(@Param('id') id: string) {
    const trip = await this.trips.findById(id);
    if (!trip) throw new NotFoundException(`Trip ${id} not found`);
    return trip;
  }
}
