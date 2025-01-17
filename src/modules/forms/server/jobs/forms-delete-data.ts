import { CronJob, CronJobContext } from '#server/types'
import dayjs from 'dayjs'

const JobName = 'forms-delete-data'
export const jobFactory = (): CronJob => {
  return {
    name: JobName,
    cron: `0 0 * * *`,
    fn: async (ctx: CronJobContext) => {
      try {
        const users = await ctx.models.User.findAllActive({
          where: {
            scheduledToDelete: dayjs().format('YYYY-MM-DD'),
          },
        })
        if (!users.length) {
          ctx.log.info(`${JobName}: No one is scheduled to be deleted today.`)
          return
        }
        ctx.log.info(
          `${JobName}: Found ${users.length} users scheduled to be deleted today.`
        )
        for (const user of users) {
          await ctx.models.FormSubmission.destroy({
            where: { userId: user.id },
          })
          ctx.log.info(
            `${JobName}: Removed FormSubmissions for user ${user.fullName} (id: ${user.id}).`
          )
        }
      } catch (e) {
        ctx.log.error(JSON.stringify(e))
      }
    },
  }
}
