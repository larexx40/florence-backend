import { WebClient } from '@slack/web-api';
import { SlackChannel } from '../constants/enum';
import { Logger } from '@nestjs/common';
import { config } from 'dotenv';

config();

const logger = new Logger('SlackHelper');

// const options = {};
// const web = new WebClient(process.env.SLACK_TOKEN, options);
const slackToken = process.env.SLACK_BOT_TOKEN;
const defaultChannel = SlackChannel.DEFAULT;

const client = new WebClient(slackToken);

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

export const sendSlackMessage = async (
  message: string,
  channel?: string | null
) => {
  const channelId = channel || SlackChannel.DEFAULT;
  try {
    const resp = await client.chat.postMessage({
      channel: channelId,
      text: '🔥 New Withdrawal Request',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: message,
          },
        },
      ],
    });

    return resp.ok;
  } catch (error: unknown) {
    logger.error(
      `SEND_SLACK_MESSAGE failed for channel ${channelId}: ${getErrorMessage(
        error
      )}`,
      error instanceof Error ? error.stack : undefined
    );
    return false;
  }
};


export const sendSlackAlert = async (
  message: string,
  channelOrUserId?: string,
  title = 'Backend Alert'
) => {
  if (!slackToken) {
    logger.error('Missing SLACK_BOT_TOKEN');
    return false;
  }

  const target = channelOrUserId || defaultChannel;

  if (!target) {
    logger.error('Missing default Slack channel and no override provided');
    return false;
  }

  try {
    const response = await client.chat.postMessage({
      channel: target,   // can be #channel OR Uxxxxxx (user DM)
      text: title,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: message,
          },
        },
      ],
    });

    return response.ok;
  } catch (error: unknown) {
    logger.error(
      `SEND_SLACK_ALERT_ERROR for target ${target}: ${getErrorMessage(error)}`,
      error instanceof Error ? error.stack : undefined
    );
    return false;
  }
};
