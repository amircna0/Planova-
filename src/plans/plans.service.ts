import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { FEATURE_UPGRADE_PLAN, LimitedResource, PLAN_DEFINITIONS, PlanName } from './plan-limits';
import { isDevelopmentPlanSwitchEnabled } from '../config/environment';

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  getPlans() {
    return Object.values(PLAN_DEFINITIONS);
  }

  async getCurrentPlan(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, plan: true },
    });
    const planName = this.normalizePlan(user?.plan);

    return {
      user,
      plan: PLAN_DEFINITIONS[planName],
      devPlanSwitchEnabled: isDevelopmentPlanSwitchEnabled(),
    };
  }

  async updatePlanForDevelopment(userId: number, plan: PlanName) {
    if (!isDevelopmentPlanSwitchEnabled()) {
      throw new ForbiddenException({
        message: 'Development plan switching is disabled',
        upgradeTo: 'billing',
      });
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { plan },
      select: { id: true, email: true, plan: true },
    });

    return {
      user,
      plan: PLAN_DEFINITIONS[plan],
    };
  }

  async assertWithinLimit(userId: number, resource: LimitedResource) {
    return this.assertWithinAvailableLimit(userId, resource, 1);
  }

  async assertWithinAvailableLimit(userId: number, resource: LimitedResource, requestedCount: number) {
    const current = await this.getCurrentPlan(userId);
    const limit = current.plan.limits[resource];

    if (limit === null) {
      return;
    }

    const count = await this.countResource(userId, resource);

    if (count + requestedCount > limit) {
      throw new ForbiddenException({
        message: `Free plan limit reached for ${resource}`,
        resource,
        current: count,
        limit,
        requested: requestedCount,
        upgradeTo: 'pro',
      });
    }
  }

  async assertFeature(userId: number, feature: string) {
    const current = await this.getCurrentPlan(userId);

    if (!current.plan.features.includes(feature)) {
      throw new ForbiddenException({
        message: `${feature} is not available on the ${current.plan.name} plan`,
        feature,
        currentPlan: current.plan.name,
        upgradeTo: FEATURE_UPGRADE_PLAN[feature] || 'premium',
      });
    }
  }

  private normalizePlan(plan?: string | null): PlanName {
    return plan === 'pro' || plan === 'premium' ? plan : 'free';
  }

  private countResource(userId: number, resource: LimitedResource) {
    if (resource === 'tasks') {
      return this.prisma.task.count({ where: { userId, status: { not: 'no_longer_important' } } });
    }

    if (resource === 'goals') {
      return this.prisma.goal.count({ where: { userId, status: { not: 'archived' } } });
    }

    return this.prisma.habit.count({ where: { userId } });
  }
}
