import { Test, TestingModule } from '@nestjs/testing';
import { PowerbiController } from './powerbi.controller';

describe('PowerbiController', () => {
  let controller: PowerbiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PowerbiController],
    }).compile();

    controller = module.get<PowerbiController>(PowerbiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
