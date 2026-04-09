import { WebClient } from '@slack/web-api';
import { SlackChannel } from '../constants/enum';

// const options = {};
// const web = new WebClient(process.env.SLACK_TOKEN, options);
const slackToken = process.env.SLACK_BOT_TOKEN;
const defaultChannel = SlackChannel.DEFAULT

const client = new WebClient(slackToken);

export const sendSlackMessage = async (message: string, channel = null) => {
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
  } catch (error) {
    console.log('SEND_SLACK_MESSAGE', { error });
    return error;
  }
};


export const sendSlackAlert = async (
  message: string,
  channelOrUserId?: string,
  title = 'Backend Alert'
) => {
  if (!slackToken) {
    console.log('❌ Missing SLACK_BOT_TOKEN');
    return false;
  }

  const target = channelOrUserId || defaultChannel;

  if (!target) {
    console.log('❌ Missing default Slack channel and no override provided');
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
  } catch (error) {
    console.log('SEND_SLACK_ALERT_ERROR:', error?.data || error);
    return false;
  }
};
