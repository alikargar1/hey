import type { Preferences } from '@hey/types/hey';
import type { Handler } from 'express';

import logger from '@hey/lib/logger';
import catchedError from 'src/lib/catchedError';
import validateIsOwnerOrStaff from 'src/lib/middlewares/validateIsOwnerOrStaff';
import prisma from 'src/lib/prisma';
import { noBody, notAllowed } from 'src/lib/responses';

export const get: Handler = async (req, res) => {
  const { id } = req.query;

  if (!id) {
    return noBody(res);
  }

  if (!(await validateIsOwnerOrStaff(req, id as string))) {
    return notAllowed(res);
  }

  try {
    const [preference, pro, features, membershipNft] =
      await prisma.$transaction([
        prisma.preference.findUnique({ where: { id: id as string } }),
        prisma.pro.findFirst({ where: { profileId: id as string } }),
        prisma.profileFeature.findMany({
          select: { feature: { select: { key: true } } },
          where: {
            enabled: true,
            feature: { enabled: true, NOT: { type: 'KILL_SWITCH' } },
            profileId: id as string
          }
        }),
        prisma.membershipNft.findUnique({ where: { id: id as string } })
      ]);

    const response: Preferences = {
      features: features.map((feature: any) => feature.feature?.key),
      hasDismissedOrMintedMembershipNft: Boolean(
        membershipNft?.dismissedOrMinted
      ),
      highSignalNotificationFilter: Boolean(
        preference?.highSignalNotificationFilter
      ),
      isPride: Boolean(preference?.isPride),
      isPro: Boolean(pro)
    };

    logger.info('Profile preferences fetched');

    return res.status(200).json({ result: response, success: true });
  } catch (error) {
    return catchedError(res, error);
  }
};
