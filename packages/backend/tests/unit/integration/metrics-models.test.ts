/**
 * Unit Tests for Metrics Models
 * 
 * Tests factory functions and helper utilities for metrics models.
 * Requerimientos: 7.1-7.6
 */

import {
  createProjectMetrics,
  createEmptyProjectMetrics,
  createVelocityData,
  createEmptyVelocityData,
  createSprintVelocity,
  createCycleTimeData,
  createEmptyCycleTimeData,
  createStatusDistribution,
  createEmptyStatusDistribution,
  createBlockedIssue,
  createBottleneck,
  calculateAverageStoryPoints,
  calculateTrend,
  filterSprintsByDateRange,
  getLastNSprints,
  calculateCycleTimeFromDurations,
  calculateMedian,
  calculatePercentile,
  calculateDaysBetween,
  getTotalIssues,
  calculateStatusPercentages,
  mergeStatusDistributions,
  calculateDaysSince,
  filterBlockedIssuesBySeverity,
  sortBlockedIssuesByDays,
  groupBlockedIssuesByBlocker,
  calculateBottleneckSeverity,
  filterBottlenecksBySeverity,
  filterBottlenecksByType,
  sortBottlenecksBySeverity,
  getTotalAffectedIssues,
  validateProjectMetrics,
  validateVelocityData,
  validateCycleTimeData,
} from '../../../src/integration/metrics-models';

describe('Metrics Models - Factory Functions', () => {
  describe('createProjectMetrics', () => {
    it('should create a complete ProjectMetrics object', () => {
      const velocity = createEmptyVelocityData();
      const cycleTime = createEmptyCycleTimeData();
      const distribution = createEmptyStatusDistribution();

      const metrics = createProjectMetrics({
        velocity,
        cycleTime,
        distribution,
      });

      expect(metrics).toEqual({
        velocity,
        cycleTime,
        distribution,
        blockedIssues: [],
        bottlenecks: [],
      });
    });

    it('should include optional blocked issues and bottlenecks', () => {
      const velocity = createEmptyVelocityData();
      const cycleTime = createEmptyCycleTimeData();
      const distribution = createEmptyStatusDistribution();
      const blockedIssues = [
        createBlockedIssue({
          issueKey: 'PROJ-1',
          summary: 'Blocked issue',
          blockedSince: new Date('2024-01-01'),
        }),
      ];
      const bottlenecks = [
        createBottleneck({
          type: 'dependency',
          affectedIssues: ['PROJ-1', 'PROJ-2'],
          description: 'Dependency bottleneck',
        }),
      ];

      const metrics = createProjectMetrics({
        velocity,
        cycleTime,
        distribution,
        blockedIssues,
        bottlenecks,
      });

      expect(metrics.blockedIssues).toEqual(blockedIssues);
      expect(metrics.bottlenecks).toEqual(bottlenecks);
    });
  });

  describe('createEmptyProjectMetrics', () => {
    it('should create empty metrics with default values', () => {
      const metrics = createEmptyProjectMetrics();

      expect(metrics.velocity.averageStoryPoints).toBe(0);
      expect(metrics.velocity.sprintVelocities).toEqual([]);
      expect(metrics.cycleTime.averageDays).toBe(0);
      expect(metrics.distribution.todo).toBe(0);
      expect(metrics.blockedIssues).toEqual([]);
      expect(metrics.bottlenecks).toEqual([]);
    });
  });

  describe('createVelocityData', () => {
    it('should create velocity data with calculated trend', () => {
      const sprints = [
        createSprintVelocity({
          sprintId: '1',
          sprintName: 'Sprint 1',
          storyPoints: 20,
          completedIssues: 10,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-14'),
        }),
        createSprintVelocity({
          sprintId: '2',
          sprintName: 'Sprint 2',
          storyPoints: 25,
          completedIssues: 12,
          startDate: new Date('2024-01-15'),
          endDate: new Date('2024-01-28'),
        }),
      ];

      const velocity = createVelocityData({
        averageStoryPoints: 22.5,
        sprintVelocities: sprints,
      });

      expect(velocity.averageStoryPoints).toBe(22.5);
      expect(velocity.sprintVelocities).toEqual(sprints);
      expect(velocity.trend).toBeDefined();
    });

    it('should accept explicit trend value', () => {
      const velocity = createVelocityData({
        averageStoryPoints: 20,
        sprintVelocities: [],
        trend: 'increasing',
      });

      expect(velocity.trend).toBe('increasing');
    });
  });

  describe('createSprintVelocity', () => {
    it('should create a sprint velocity object', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-14');

      const sprint = createSprintVelocity({
        sprintId: '1',
        sprintName: 'Sprint 1',
        storyPoints: 20,
        completedIssues: 10,
        startDate,
        endDate,
      });

      expect(sprint).toEqual({
        sprintId: '1',
        sprintName: 'Sprint 1',
        storyPoints: 20,
        completedIssues: 10,
        startDate,
        endDate,
      });
    });
  });

  describe('createCycleTimeData', () => {
    it('should create cycle time data', () => {
      const cycleTime = createCycleTimeData({
        averageDays: 5.5,
        median: 4.0,
        percentile90: 10.0,
      });

      expect(cycleTime).toEqual({
        averageDays: 5.5,
        median: 4.0,
        percentile90: 10.0,
      });
    });
  });

  describe('createStatusDistribution', () => {
    it('should create status distribution', () => {
      const distribution = createStatusDistribution({
        todo: 10,
        inProgress: 5,
        done: 20,
        blocked: 2,
      });

      expect(distribution).toEqual({
        todo: 10,
        inProgress: 5,
        done: 20,
        blocked: 2,
      });
    });
  });

  describe('createBlockedIssue', () => {
    it('should create blocked issue with calculated days', () => {
      const blockedSince = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

      const issue = createBlockedIssue({
        issueKey: 'PROJ-1',
        summary: 'Blocked issue',
        blockedSince,
      });

      expect(issue.issueKey).toBe('PROJ-1');
      expect(issue.summary).toBe('Blocked issue');
      expect(issue.blockedSince).toEqual(blockedSince);
      expect(issue.blockedDays).toBeGreaterThanOrEqual(4);
      expect(issue.blockedDays).toBeLessThanOrEqual(6);
    });

    it('should include optional blocker and reason', () => {
      const issue = createBlockedIssue({
        issueKey: 'PROJ-1',
        summary: 'Blocked issue',
        blockedSince: new Date(),
        blocker: 'PROJ-2',
        reason: 'Waiting for dependency',
      });

      expect(issue.blocker).toBe('PROJ-2');
      expect(issue.reason).toBe('Waiting for dependency');
    });
  });

  describe('createBottleneck', () => {
    it('should create bottleneck with calculated severity', () => {
      const bottleneck = createBottleneck({
        type: 'dependency',
        affectedIssues: ['PROJ-1', 'PROJ-2', 'PROJ-3'],
        description: 'Dependency bottleneck',
      });

      expect(bottleneck.type).toBe('dependency');
      expect(bottleneck.affectedIssues).toHaveLength(3);
      expect(bottleneck.description).toBe('Dependency bottleneck');
      expect(bottleneck.severity).toBeDefined();
    });

    it('should accept explicit severity', () => {
      const bottleneck = createBottleneck({
        type: 'resource',
        affectedIssues: ['PROJ-1'],
        description: 'Resource bottleneck',
        severity: 'high',
      });

      expect(bottleneck.severity).toBe('high');
    });
  });
});

describe('Metrics Models - Velocity Helpers', () => {
  describe('calculateAverageStoryPoints', () => {
    it('should calculate average from sprints', () => {
      const sprints = [
        createSprintVelocity({
          sprintId: '1',
          sprintName: 'Sprint 1',
          storyPoints: 20,
          completedIssues: 10,
          startDate: new Date(),
          endDate: new Date(),
        }),
        createSprintVelocity({
          sprintId: '2',
          sprintName: 'Sprint 2',
          storyPoints: 30,
          completedIssues: 15,
          startDate: new Date(),
          endDate: new Date(),
        }),
      ];

      const average = calculateAverageStoryPoints(sprints);
      expect(average).toBe(25);
    });

    it('should return 0 for empty array', () => {
      expect(calculateAverageStoryPoints([])).toBe(0);
    });
  });

  describe('calculateTrend', () => {
    it('should return "stable" for less than 2 sprints', () => {
      const sprints = [
        createSprintVelocity({
          sprintId: '1',
          sprintName: 'Sprint 1',
          storyPoints: 20,
          completedIssues: 10,
          startDate: new Date(),
          endDate: new Date(),
        }),
      ];

      expect(calculateTrend(sprints)).toBe('stable');
    });

    it('should detect increasing trend', () => {
      const sprints = [
        createSprintVelocity({
          sprintId: '1',
          sprintName: 'Sprint 1',
          storyPoints: 10,
          completedIssues: 5,
          startDate: new Date(),
          endDate: new Date(),
        }),
        createSprintVelocity({
          sprintId: '2',
          sprintName: 'Sprint 2',
          storyPoints: 15,
          completedIssues: 7,
          startDate: new Date(),
          endDate: new Date(),
        }),
        createSprintVelocity({
          sprintId: '3',
          sprintName: 'Sprint 3',
          storyPoints: 20,
          completedIssues: 10,
          startDate: new Date(),
          endDate: new Date(),
        }),
        createSprintVelocity({
          sprintId: '4',
          sprintName: 'Sprint 4',
          storyPoints: 25,
          completedIssues: 12,
          startDate: new Date(),
          endDate: new Date(),
        }),
      ];

      expect(calculateTrend(sprints)).toBe('increasing');
    });

    it('should detect decreasing trend', () => {
      const sprints = [
        createSprintVelocity({
          sprintId: '1',
          sprintName: 'Sprint 1',
          storyPoints: 25,
          completedIssues: 12,
          startDate: new Date(),
          endDate: new Date(),
        }),
        createSprintVelocity({
          sprintId: '2',
          sprintName: 'Sprint 2',
          storyPoints: 20,
          completedIssues: 10,
          startDate: new Date(),
          endDate: new Date(),
        }),
        createSprintVelocity({
          sprintId: '3',
          sprintName: 'Sprint 3',
          storyPoints: 15,
          completedIssues: 7,
          startDate: new Date(),
          endDate: new Date(),
        }),
        createSprintVelocity({
          sprintId: '4',
          sprintName: 'Sprint 4',
          storyPoints: 10,
          completedIssues: 5,
          startDate: new Date(),
          endDate: new Date(),
        }),
      ];

      expect(calculateTrend(sprints)).toBe('decreasing');
    });
  });

  describe('filterSprintsByDateRange', () => {
    it('should filter sprints within date range', () => {
      const sprints = [
        createSprintVelocity({
          sprintId: '1',
          sprintName: 'Sprint 1',
          storyPoints: 20,
          completedIssues: 10,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-14'),
        }),
        createSprintVelocity({
          sprintId: '2',
          sprintName: 'Sprint 2',
          storyPoints: 25,
          completedIssues: 12,
          startDate: new Date('2024-02-01'),
          endDate: new Date('2024-02-14'),
        }),
      ];

      const filtered = filterSprintsByDateRange(
        sprints,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].sprintId).toBe('1');
    });
  });

  describe('getLastNSprints', () => {
    it('should return last N sprints', () => {
      const sprints = [
        createSprintVelocity({
          sprintId: '1',
          sprintName: 'Sprint 1',
          storyPoints: 20,
          completedIssues: 10,
          startDate: new Date(),
          endDate: new Date(),
        }),
        createSprintVelocity({
          sprintId: '2',
          sprintName: 'Sprint 2',
          storyPoints: 25,
          completedIssues: 12,
          startDate: new Date(),
          endDate: new Date(),
        }),
        createSprintVelocity({
          sprintId: '3',
          sprintName: 'Sprint 3',
          storyPoints: 30,
          completedIssues: 15,
          startDate: new Date(),
          endDate: new Date(),
        }),
      ];

      const last2 = getLastNSprints(sprints, 2);
      expect(last2).toHaveLength(2);
      expect(last2[0].sprintId).toBe('2');
      expect(last2[1].sprintId).toBe('3');
    });
  });
});


describe('Metrics Models - Cycle Time Helpers', () => {
  describe('calculateCycleTimeFromDurations', () => {
    it('should calculate cycle time metrics from durations', () => {
      const durations = [2, 3, 5, 7, 10, 12, 15];

      const cycleTime = calculateCycleTimeFromDurations(durations);

      expect(cycleTime.averageDays).toBeCloseTo(7.71, 1);
      expect(cycleTime.median).toBe(7);
      expect(cycleTime.percentile90).toBeGreaterThan(cycleTime.median);
    });

    it('should return empty cycle time for empty array', () => {
      const cycleTime = calculateCycleTimeFromDurations([]);

      expect(cycleTime.averageDays).toBe(0);
      expect(cycleTime.median).toBe(0);
      expect(cycleTime.percentile90).toBe(0);
    });
  });

  describe('calculateMedian', () => {
    it('should calculate median for odd-length array', () => {
      expect(calculateMedian([1, 2, 3, 4, 5])).toBe(3);
    });

    it('should calculate median for even-length array', () => {
      expect(calculateMedian([1, 2, 3, 4])).toBe(2.5);
    });

    it('should return 0 for empty array', () => {
      expect(calculateMedian([])).toBe(0);
    });
  });

  describe('calculatePercentile', () => {
    it('should calculate 90th percentile', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const p90 = calculatePercentile(values, 90);

      expect(p90).toBeCloseTo(9.1, 1);
    });

    it('should calculate 50th percentile (median)', () => {
      const values = [1, 2, 3, 4, 5];
      const p50 = calculatePercentile(values, 50);

      expect(p50).toBe(3);
    });

    it('should throw error for invalid percentile', () => {
      expect(() => calculatePercentile([1, 2, 3], -1)).toThrow();
      expect(() => calculatePercentile([1, 2, 3], 101)).toThrow();
    });
  });

  describe('calculateDaysBetween', () => {
    it('should calculate days between two dates', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-08');

      expect(calculateDaysBetween(start, end)).toBe(7);
    });

    it('should handle same date', () => {
      const date = new Date('2024-01-01');

      expect(calculateDaysBetween(date, date)).toBe(0);
    });
  });
});

describe('Metrics Models - Status Distribution Helpers', () => {
  describe('getTotalIssues', () => {
    it('should calculate total issues', () => {
      const distribution = createStatusDistribution({
        todo: 10,
        inProgress: 5,
        done: 20,
        blocked: 2,
      });

      expect(getTotalIssues(distribution)).toBe(37);
    });
  });

  describe('calculateStatusPercentages', () => {
    it('should calculate percentages for each status', () => {
      const distribution = createStatusDistribution({
        todo: 10,
        inProgress: 10,
        done: 60,
        blocked: 20,
      });

      const percentages = calculateStatusPercentages(distribution);

      expect(percentages.todo).toBe(10);
      expect(percentages.inProgress).toBe(10);
      expect(percentages.done).toBe(60);
      expect(percentages.blocked).toBe(20);
    });

    it('should return zeros for empty distribution', () => {
      const distribution = createEmptyStatusDistribution();
      const percentages = calculateStatusPercentages(distribution);

      expect(percentages.todo).toBe(0);
      expect(percentages.inProgress).toBe(0);
      expect(percentages.done).toBe(0);
      expect(percentages.blocked).toBe(0);
    });
  });

  describe('mergeStatusDistributions', () => {
    it('should merge multiple distributions', () => {
      const dist1 = createStatusDistribution({
        todo: 5,
        inProgress: 3,
        done: 10,
        blocked: 1,
      });

      const dist2 = createStatusDistribution({
        todo: 3,
        inProgress: 2,
        done: 8,
        blocked: 1,
      });

      const merged = mergeStatusDistributions([dist1, dist2]);

      expect(merged.todo).toBe(8);
      expect(merged.inProgress).toBe(5);
      expect(merged.done).toBe(18);
      expect(merged.blocked).toBe(2);
    });
  });
});

describe('Metrics Models - Blocked Issues Helpers', () => {
  describe('filterBlockedIssuesBySeverity', () => {
    it('should filter issues by minimum days', () => {
      const issues = [
        createBlockedIssue({
          issueKey: 'PROJ-1',
          summary: 'Issue 1',
          blockedSince: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        }),
        createBlockedIssue({
          issueKey: 'PROJ-2',
          summary: 'Issue 2',
          blockedSince: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        }),
      ];

      const filtered = filterBlockedIssuesBySeverity(issues, 5);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].issueKey).toBe('PROJ-2');
    });
  });

  describe('sortBlockedIssuesByDays', () => {
    it('should sort issues by blocked days descending', () => {
      const issues = [
        createBlockedIssue({
          issueKey: 'PROJ-1',
          summary: 'Issue 1',
          blockedSince: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        }),
        createBlockedIssue({
          issueKey: 'PROJ-2',
          summary: 'Issue 2',
          blockedSince: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        }),
        createBlockedIssue({
          issueKey: 'PROJ-3',
          summary: 'Issue 3',
          blockedSince: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        }),
      ];

      const sorted = sortBlockedIssuesByDays(issues);

      expect(sorted[0].issueKey).toBe('PROJ-2');
      expect(sorted[1].issueKey).toBe('PROJ-3');
      expect(sorted[2].issueKey).toBe('PROJ-1');
    });
  });

  describe('groupBlockedIssuesByBlocker', () => {
    it('should group issues by blocker', () => {
      const issues = [
        createBlockedIssue({
          issueKey: 'PROJ-1',
          summary: 'Issue 1',
          blockedSince: new Date(),
          blocker: 'PROJ-10',
        }),
        createBlockedIssue({
          issueKey: 'PROJ-2',
          summary: 'Issue 2',
          blockedSince: new Date(),
          blocker: 'PROJ-10',
        }),
        createBlockedIssue({
          issueKey: 'PROJ-3',
          summary: 'Issue 3',
          blockedSince: new Date(),
          blocker: 'PROJ-20',
        }),
      ];

      const grouped = groupBlockedIssuesByBlocker(issues);

      expect(grouped.size).toBe(2);
      expect(grouped.get('PROJ-10')).toHaveLength(2);
      expect(grouped.get('PROJ-20')).toHaveLength(1);
    });

    it('should group issues without blocker as "Unknown"', () => {
      const issues = [
        createBlockedIssue({
          issueKey: 'PROJ-1',
          summary: 'Issue 1',
          blockedSince: new Date(),
        }),
      ];

      const grouped = groupBlockedIssuesByBlocker(issues);

      expect(grouped.get('Unknown')).toHaveLength(1);
    });
  });
});

describe('Metrics Models - Bottleneck Helpers', () => {
  describe('calculateBottleneckSeverity', () => {
    it('should return "high" for 10+ affected issues', () => {
      expect(calculateBottleneckSeverity(10)).toBe('high');
      expect(calculateBottleneckSeverity(15)).toBe('high');
    });

    it('should return "medium" for 5-9 affected issues', () => {
      expect(calculateBottleneckSeverity(5)).toBe('medium');
      expect(calculateBottleneckSeverity(9)).toBe('medium');
    });

    it('should return "low" for less than 5 affected issues', () => {
      expect(calculateBottleneckSeverity(1)).toBe('low');
      expect(calculateBottleneckSeverity(4)).toBe('low');
    });
  });

  describe('filterBottlenecksBySeverity', () => {
    it('should filter bottlenecks by severity', () => {
      const bottlenecks = [
        createBottleneck({
          type: 'dependency',
          affectedIssues: ['1', '2'],
          description: 'Low severity',
          severity: 'low',
        }),
        createBottleneck({
          type: 'resource',
          affectedIssues: ['1', '2', '3', '4', '5'],
          description: 'Medium severity',
          severity: 'medium',
        }),
        createBottleneck({
          type: 'blocker',
          affectedIssues: Array(10).fill('issue'),
          description: 'High severity',
          severity: 'high',
        }),
      ];

      const highSeverity = filterBottlenecksBySeverity(bottlenecks, 'high');
      expect(highSeverity).toHaveLength(1);
      expect(highSeverity[0].severity).toBe('high');
    });
  });

  describe('filterBottlenecksByType', () => {
    it('should filter bottlenecks by type', () => {
      const bottlenecks = [
        createBottleneck({
          type: 'dependency',
          affectedIssues: ['1'],
          description: 'Dependency',
        }),
        createBottleneck({
          type: 'resource',
          affectedIssues: ['2'],
          description: 'Resource',
        }),
        createBottleneck({
          type: 'dependency',
          affectedIssues: ['3'],
          description: 'Another dependency',
        }),
      ];

      const dependencies = filterBottlenecksByType(bottlenecks, 'dependency');
      expect(dependencies).toHaveLength(2);
    });
  });

  describe('sortBottlenecksBySeverity', () => {
    it('should sort bottlenecks by severity (high > medium > low)', () => {
      const bottlenecks = [
        createBottleneck({
          type: 'dependency',
          affectedIssues: ['1'],
          description: 'Low',
          severity: 'low',
        }),
        createBottleneck({
          type: 'resource',
          affectedIssues: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
          description: 'High',
          severity: 'high',
        }),
        createBottleneck({
          type: 'blocker',
          affectedIssues: ['1', '2', '3', '4', '5'],
          description: 'Medium',
          severity: 'medium',
        }),
      ];

      const sorted = sortBottlenecksBySeverity(bottlenecks);

      expect(sorted[0].severity).toBe('high');
      expect(sorted[1].severity).toBe('medium');
      expect(sorted[2].severity).toBe('low');
    });
  });

  describe('getTotalAffectedIssues', () => {
    it('should count unique affected issues', () => {
      const bottlenecks = [
        createBottleneck({
          type: 'dependency',
          affectedIssues: ['PROJ-1', 'PROJ-2', 'PROJ-3'],
          description: 'Bottleneck 1',
        }),
        createBottleneck({
          type: 'resource',
          affectedIssues: ['PROJ-2', 'PROJ-3', 'PROJ-4'],
          description: 'Bottleneck 2',
        }),
      ];

      const total = getTotalAffectedIssues(bottlenecks);
      expect(total).toBe(4); // PROJ-1, PROJ-2, PROJ-3, PROJ-4
    });
  });
});

describe('Metrics Models - Validation', () => {
  describe('validateProjectMetrics', () => {
    it('should validate valid metrics', () => {
      const metrics = createProjectMetrics({
        velocity: createVelocityData({
          averageStoryPoints: 20,
          sprintVelocities: [],
        }),
        cycleTime: createCycleTimeData({
          averageDays: 5,
          median: 4,
          percentile90: 10,
        }),
        distribution: createStatusDistribution({
          todo: 10,
          inProgress: 5,
          done: 20,
          blocked: 2,
        }),
      });

      const result = validateProjectMetrics(metrics);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect negative values', () => {
      const metrics = createProjectMetrics({
        velocity: createVelocityData({
          averageStoryPoints: -5,
          sprintVelocities: [],
        }),
        cycleTime: createCycleTimeData({
          averageDays: -1,
          median: 4,
          percentile90: 10,
        }),
        distribution: createStatusDistribution({
          todo: -1,
          inProgress: 5,
          done: 20,
          blocked: 2,
        }),
      });

      const result = validateProjectMetrics(metrics);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateVelocityData', () => {
    it('should validate valid velocity data', () => {
      const velocity = createVelocityData({
        averageStoryPoints: 20,
        sprintVelocities: [
          createSprintVelocity({
            sprintId: '1',
            sprintName: 'Sprint 1',
            storyPoints: 20,
            completedIssues: 10,
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-14'),
          }),
        ],
      });

      const result = validateVelocityData(velocity);
      expect(result.valid).toBe(true);
    });

    it('should detect invalid sprint dates', () => {
      const velocity = createVelocityData({
        averageStoryPoints: 20,
        sprintVelocities: [
          createSprintVelocity({
            sprintId: '1',
            sprintName: 'Sprint 1',
            storyPoints: 20,
            completedIssues: 10,
            startDate: new Date('2024-01-14'),
            endDate: new Date('2024-01-01'), // End before start
          }),
        ],
      });

      const result = validateVelocityData(velocity);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('start date'))).toBe(true);
    });
  });

  describe('validateCycleTimeData', () => {
    it('should validate valid cycle time data', () => {
      const cycleTime = createCycleTimeData({
        averageDays: 5,
        median: 4,
        percentile90: 10,
      });

      const result = validateCycleTimeData(cycleTime);
      expect(result.valid).toBe(true);
    });

    it('should detect invalid percentile relationship', () => {
      const cycleTime = createCycleTimeData({
        averageDays: 5,
        median: 10,
        percentile90: 5, // P90 should be >= median
      });

      const result = validateCycleTimeData(cycleTime);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Percentile 90'))).toBe(true);
    });
  });
});
