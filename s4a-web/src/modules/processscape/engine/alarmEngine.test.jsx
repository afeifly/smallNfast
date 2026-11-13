import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  evaluateLiveTelemetry,
  getActiveAlarms,
  getAlarmHistory,
  clearAlarmHistory,
  resetAlarmEngine,
  acknowledgeAlarm,
  acknowledgeAllAlarms,
  setChannelAlarmConfig,
  isChannelInAlarm,
  isChannelValueInAlarm,
  refreshAssignedChannels,
  clearActiveAlarmForChannel,
  subscribeAlarms
} from './alarmEngine';
import { saveLocations, getLocations } from './sensorManagerStorage';
import * as liveDataSource from '../../../util/liveDataSource';

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AlarmCenterModal from '../../../components/AlarmCenterModal';
import { renderSensorCard } from './illustrators';

describe('alarmEngine', () => {
  beforeEach(() => {
    localStorage.clear();
    resetAlarmEngine();
  });

  it('evaluates High Limit alarm with hysteresis correctly', () => {
    const locId = 'loc_test_1';
    const mpId = 'mp_test_1';
    const chId = 'ch_dev_test_1';

    saveLocations([
      {
        id: locId,
        name: 'Compressor Station',
        scapeId: 'scape_1',
        measurementPoints: [
          {
            id: mpId,
            name: 'Discharge Point',
            channels: [
              {
                id: chId,
                name: 'Pressure',
                unit: 'bar',
                val: '7.5',
                alarmConfig: {
                  enabled: true,
                  type: 'high',
                  threshold: 8.0,
                  hysteresis: 0.3,
                  delaySeconds: 0,
                  severity: 'critical'
                }
              }
            ]
          }
        ]
      }
    ]);

    // 1. Telemetry at 7.8 bar: below threshold (8.0) -> No alarm
    evaluateLiveTelemetry([{ id: chId, value: 7.8 }]);
    expect(getActiveAlarms().length).toBe(0);
    expect(isChannelInAlarm(chId, locId)).toBe(false);

    // 2. Telemetry rises to 8.2 bar: exceeds 8.0 -> Alarm triggers!
    evaluateLiveTelemetry([{ id: chId, value: 8.2 }]);
    expect(getActiveAlarms().length).toBe(1);
    expect(getActiveAlarms()[0].currentValue).toBe('8.20');
    expect(getActiveAlarms()[0].locationName).toBe('Compressor Station');
    expect(isChannelInAlarm(chId, locId)).toBe(true);

    // Verify history has triggered event
    const history1 = getAlarmHistory();
    expect(history1.length).toBe(1);
    expect(history1[0].eventType).toBe('triggered');

    // 3. Telemetry drops to 7.9 bar: below threshold (8.0), but within hysteresis deadband (8.0 - 0.3 = 7.7) -> Alarm stays active!
    evaluateLiveTelemetry([{ id: chId, value: 7.9 }]);
    expect(getActiveAlarms().length).toBe(1);
    expect(getActiveAlarms()[0].currentValue).toBe('7.90');

    // 4. Telemetry drops to 7.6 bar: below 7.7 (threshold - hysteresis) -> Alarm clears!
    evaluateLiveTelemetry([{ id: chId, value: 7.6 }]);
    expect(getActiveAlarms().length).toBe(0);
    expect(isChannelInAlarm(chId, locId)).toBe(false);

    // History now has triggered + cleared events with duration
    const history2 = getAlarmHistory();
    expect(history2.length).toBe(2);
    expect(history2[0].eventType).toBe('cleared');
    expect(history2[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('evaluates Low Limit alarm with hysteresis correctly', () => {
    const locId = 'loc_test_low';
    const mpId = 'mp_test_low';
    const chId = 'ch_pressure_inlet';

    saveLocations([
      {
        id: locId,
        name: 'Inlet Manifold',
        scapeId: 'scape_low',
        measurementPoints: [
          {
            id: mpId,
            name: 'Suction Header',
            channels: [
              {
                id: chId,
                name: 'Suction Pressure',
                unit: 'bar',
                alarmConfig: {
                  enabled: true,
                  type: 'low',
                  threshold: 2.0,
                  hysteresis: 0.2,
                  delaySeconds: 0,
                  severity: 'warning'
                }
              }
            ]
          }
        ]
      }
    ]);

    // Above threshold -> normal
    evaluateLiveTelemetry([{ id: chId, value: 2.5 }]);
    expect(getActiveAlarms().length).toBe(0);

    // Drops to 1.8 -> alarm triggers
    evaluateLiveTelemetry([{ id: chId, value: 1.8 }]);
    expect(getActiveAlarms().length).toBe(1);
    expect(getActiveAlarms()[0].severity).toBe('warning');

    // Rises to 2.1 (less than 2.0 + 0.2 = 2.2) -> stays in alarm due to hysteresis
    evaluateLiveTelemetry([{ id: chId, value: 2.1 }]);
    expect(getActiveAlarms().length).toBe(1);

    // Rises to 2.3 -> clears
    evaluateLiveTelemetry([{ id: chId, value: 2.3 }]);
    expect(getActiveAlarms().length).toBe(0);
  });

  it('evaluates Out of Range (band) alarm correctly', () => {
    const ch = {
      alarmConfig: {
        enabled: true,
        type: 'out_of_range',
        min: 2.0,
        max: 8.0,
        hysteresis: 0.2
      }
    };

    expect(isChannelValueInAlarm(ch, 5.0)).toBe(false);
    expect(isChannelValueInAlarm(ch, 1.8)).toBe(true);
    expect(isChannelValueInAlarm(ch, 8.5)).toBe(true);
  });

  it('acknowledges active alarms and appends acknowledged event in history', () => {
    const locId = 'loc_ack';
    const mpId = 'mp_ack';
    const chId = 'ch_ack_1';

    saveLocations([
      {
        id: locId,
        name: 'Header Room',
        measurementPoints: [
          {
            id: mpId,
            name: 'Delivery',
            channels: [
              {
                id: chId,
                name: 'Temperature',
                unit: '°C',
                alarmConfig: {
                  enabled: true,
                  type: 'high',
                  threshold: 60,
                  hysteresis: 1,
                  severity: 'critical'
                }
              }
            ]
          }
        ]
      }
    ]);

    evaluateLiveTelemetry([{ id: chId, value: 65 }]);
    expect(getActiveAlarms().length).toBe(1);
    const alarmId = getActiveAlarms()[0].id;
    expect(getActiveAlarms()[0].acknowledged).toBe(false);

    acknowledgeAlarm(alarmId);
    expect(getActiveAlarms()[0].acknowledged).toBe(true);

    const history = getAlarmHistory();
    expect(history.some(h => h.eventType === 'acknowledged')).toBe(true);
  });

  it('setChannelAlarmConfig updates channel config in storage and demands channels', () => {
    const locId = 'loc_cfg';
    const mpId = 'mp_cfg';
    const chId = 'ch_cfg_1';

    saveLocations([
      {
        id: locId,
        name: 'Receiver Tank',
        measurementPoints: [
          {
            id: mpId,
            name: 'Tank Pressure',
            channels: [
              {
                id: chId,
                name: 'Pressure',
                unit: 'bar'
              }
            ]
          }
        ]
      }
    ]);

    setChannelAlarmConfig(locId, mpId, chId, {
      enabled: true,
      type: 'high',
      threshold: 9.5,
      hysteresis: 0.5,
      delaySeconds: 2,
      severity: 'critical',
      message: 'Tank overpressure!'
    });

    const updated = getLocations();
    const ch = updated[0].measurementPoints[0].channels[0];
    expect(ch.alarmConfig).toBeDefined();
    expect(ch.alarmConfig.threshold).toBe(9.5);
    expect(ch.alarmConfig.message).toBe('Tank overpressure!');
  });

  it('completely removes active alarm when alarm is disabled, keeping history audit trail', () => {
    const locId = 'loc_disable_test';
    const mpId = 'mp_disable_test';
    const chId = 'ch_disable_test';

    saveLocations([
      {
        id: locId,
        name: 'Test Plant',
        scapeId: 'scape_disable',
        measurementPoints: [
          {
            id: mpId,
            name: 'Line 1',
            channels: [
              {
                id: chId,
                name: 'Temperature',
                unit: '°C',
                alarmConfig: {
                  enabled: true,
                  type: 'high',
                  threshold: 50,
                  hysteresis: 1,
                  delaySeconds: 0,
                  severity: 'critical'
                }
              }
            ]
          }
        ]
      }
    ]);

    // 1. Trigger alarm with value 60
    evaluateLiveTelemetry([{ id: chId, value: 60 }]);
    expect(getActiveAlarms().length).toBe(1);
    expect(isChannelInAlarm(chId, locId)).toBe(true);

    // 2. Disable alarm via setChannelAlarmConfig
    setChannelAlarmConfig(locId, mpId, chId, {
      enabled: false,
      type: 'high',
      threshold: 50
    });

    // Active alarms must be empty immediately
    expect(getActiveAlarms().length).toBe(0);
    expect(isChannelInAlarm(chId, locId)).toBe(false);

    // History preserves the triggered event and records a cleared event with duration
    const history = getAlarmHistory();
    expect(history.length).toBe(2);
    expect(history[0].eventType).toBe('cleared');
    expect(history[0].currentValue).toBe('Alarm Disabled');
    expect(history[1].eventType).toBe('triggered');

    // 3. Further telemetry with high value should NOT re-trigger alarm while disabled
    evaluateLiveTelemetry([{ id: chId, value: 75 }]);
    expect(getActiveAlarms().length).toBe(0);
    expect(isChannelInAlarm(chId, locId)).toBe(false);
  });

  it('renders AlarmCenterModal and navigates to alarm location on click', () => {
    const locId = 'loc_jump_test';
    const mpId = 'mp_jump_test';
    const chId = 'ch_jump_1';

    saveLocations([
      {
        id: locId,
        name: 'Booster Station B',
        scapeId: 'scape_booster',
        measurementPoints: [
          {
            id: mpId,
            name: 'Outlet Discharge',
            channels: [
              {
                id: chId,
                name: 'Dew Point',
                unit: '°Ctd',
                alarmConfig: {
                  enabled: true,
                  type: 'high',
                  threshold: -20,
                  severity: 'critical'
                }
              }
            ]
          }
        ]
      }
    ]);

    evaluateLiveTelemetry([{ id: chId, value: -15 }]);
    expect(getActiveAlarms().length).toBe(1);

    const onGoToLocation = vi.fn();
    const { container } = render(
      <AlarmCenterModal
        isOpen={true}
        onClose={vi.fn()}
        onGoToLocation={onGoToLocation}
      />
    );

    expect(container.textContent).toContain('Booster Station B');
    expect(container.textContent).toContain('Dew Point');
    expect(container.textContent).toContain('-15');

    const jumpBtn = container.querySelector('.alarm-jump-btn');
    expect(jumpBtn).not.toBeNull();
    fireEvent.click(jumpBtn);

    expect(onGoToLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        locationId: locId,
        locationName: 'Booster Station B'
      })
    );
  });

  it('renderSensorCard applies blinking red class ps-channel-alarm-blink to unacknowledged alarms and solid red to acknowledged alarms', () => {
    const cardNormal = {
      id: 'card_1',
      type: 'sensor_card',
      tag: 'Air Compressor',
      x: 100,
      y: 100,
      channels: [
        { id: 'ch_1', name: 'Pressure', val: '7.2', unit: 'bar', status: 'normal' }
      ]
    };

    const cardAlarmUnacked = {
      id: 'card_2',
      type: 'sensor_card',
      tag: 'Air Compressor',
      x: 100,
      y: 100,
      channels: [
        { id: 'ch_2', name: 'Pressure', val: '9.8', unit: 'bar', isAlarm: true, isAlarmAcked: false, status: 'alarm' }
      ]
    };

    const cardAlarmAcked = {
      id: 'card_3',
      type: 'sensor_card',
      tag: 'Air Compressor',
      x: 100,
      y: 100,
      channels: [
        { id: 'ch_3', name: 'Pressure', val: '9.8', unit: 'bar', isAlarm: true, isAlarmAcked: true, status: 'alarm' }
      ]
    };

    const gNormal = renderSensorCard(cardNormal);
    const gUnacked = renderSensorCard(cardAlarmUnacked);
    const gAcked = renderSensorCard(cardAlarmAcked);

    expect(gNormal.querySelector('.ps-channel-alarm-blink')).toBeNull();
    expect(gNormal.querySelector('.ps-channel-alarm-solid')).toBeNull();

    // Unacknowledged: blinks red
    expect(gUnacked.querySelector('.ps-channel-alarm-blink')).not.toBeNull();
    expect(gUnacked.querySelector('.ps-alarm-dot-pulse')).not.toBeNull();
    expect(gUnacked.querySelector('.ps-channel-alarm-solid')).toBeNull();

    // Acknowledged: stops blinking, keeps solid red
    expect(gAcked.querySelector('.ps-channel-alarm-blink')).toBeNull();
    expect(gAcked.querySelector('.ps-channel-alarm-solid')).not.toBeNull();
    expect(gAcked.querySelector('.ps-alarm-dot-solid')).not.toBeNull();
  });

  it('renders yellow warning dot when value is special sentinel or --.-', () => {
    const cardWarn = {
      id: 'card_warn',
      type: 'sensor_card',
      name: 'Flow Meter',
      x: 100,
      y: 100,
      channels: [
        { id: 'ch_1', name: 'Flow', val: '--.-', unit: 'm³/h' },
        { id: 'ch_2', name: 'Pressure', val: -9999, unit: 'bar' }
      ]
    };

    const g = renderSensorCard(cardWarn);
    const circles = g.querySelectorAll('circle');
    // Channel status dots
    const dots = Array.from(circles).filter(c => c.getAttribute('r') === '4.2');
    expect(dots.length).toBe(2);
    expect(dots[0].getAttribute('fill')).toBe('#eab308');
    expect(dots[1].getAttribute('fill')).toBe('#eab308');
  });
});
