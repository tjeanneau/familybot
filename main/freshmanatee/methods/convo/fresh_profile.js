/**
 * Created by thomasjeanneau on 30/05/2017.
 */

import _ from 'lodash'

import controller, { log } from '../../config'
import { getMemberWithSkills, saveProfile, sort } from '../index'
import moment from 'moment'

export default (convo, nextThread = 'exit') => {
  convo.addMessage({
    text: 'Looking your profile :sleuth_or_spy:',
    action: 'search'
  }, 'fresh_profile')

  convo.beforeThread('search', (convo, next) => {
    getMemberWithSkills(convo.context.user)
      .then((profile) => {
        const currentSkills = _.map(profile.get('Skills'), ({ text }) => text)
        currentSkills.sort(sort)
        convo.setVar('bio', profile.get('Bio'))
        convo.setVar('location', profile.get('Location'))
        convo.setVar('focus', profile.get('Focus'))
        convo.setVar('challenges', profile.get('Challenges'))
        convo.setVar('currentSkills', currentSkills && currentSkills.length > 0 ? currentSkills.join(', ') : 'No one')
        next()
      })
      .catch((err) => {
        log('the `getMember` method', err)
        convo.stop()
        next('stop')
      })
  })

  const monthNb = moment().format('MM')
  const dayNb = moment().format('DD')
  const attachments = [
    {
      'title': ':house_with_garden: Location',
      'text': '{{#vars.location}}{{{vars.location}}}{{/vars.location}}{{^vars.location}}None{{/vars.location}}',
      'color': '#8BC34A'
    },
    {
      'title': ':rocket: Focus',
      'text': '{{#vars.focus}}{{{vars.focus}}}{{/vars.focus}}{{^vars.focus}}None{{/vars.focus}}',
      'color': '#CDDC39'
    },
    {
      'title': ':tornado: Challenges',
      'text': '{{#vars.challenges}}{{{vars.challenges}}}{{/vars.challenges}}{{^vars.challenges}}None{{/vars.challenges}}',
      'color': '#F44336'
    }
  ]

  if (monthNb % 2 === 1 && dayNb <= 14) {
    attachments.unshift({
      'title': ':writing_hand: Bio',
      'text': '{{#vars.bio}}{{{vars.bio}}}{{/vars.bio}}{{^vars.bio}}None{{/vars.bio}}',
      'color': '#FFEB3B'
    }, {
      'title': ':muscle: Skills',
      'text': '{{#vars.currentSkills}}{{{vars.currentSkills}}}{{/vars.currentSkills}}{{^vars.currentSkills}}No one{{/vars.currentSkills}}',
      'color': '#FF9800'
    })
  }

  convo.addMessage({
    text: `Here's your current information:`,
    attachments
  }, 'search')

  convo.addQuestion({
    attachments: [{
      title: 'Do you want to update this information?',
      callback_id: 'update_info',
      attachment_type: 'default',
      actions: [
        {
          name: 'yes',
          text: 'Yes',
          value: 'Yes',
          type: 'button',
          style: 'primary'
        },
        {
          name: 'no',
          text: 'No',
          value: 'No',
          type: 'button'
        }
      ]
    }]
  }, function (reply, convo) {
    if (reply.callback_id === 'update_info') {
      const { context: { bot }, vars: { location, focus, challenges, bio } } = convo
      bot.replyInteractive(reply, {
        attachments: [{
          title: 'Do you want to update this information?',
          text: `_${reply.actions[0].value}_`,
          mrkdwn_in: ['text']
        }]
      })
      if (reply.actions[0].name === 'yes') {
        const dialog = bot
          .createDialog(
            'Fresh your profile',
            'fresh_profile',
            'Fresh')
          .addText('Update your location', 'Location', location, {
            placeholder: 'Whats your current location (City, Country)?'
          })
          .addTextarea('Share your focus', 'Focus', focus, {
            max_length: 300,
            placeholder: 'What is your main focus for the next two weeks?'
          })
          .addTextarea('Share your challenges', 'Challenges', challenges, {
            max_length: 300,
            optional: false,
            placeholder: 'What challenges do you currently face in your projects and life?',
            hint: '@catalyst team are here to help you to resolve them. Try to write actionable challenges for a better mutual help.'
          })
          .addTextarea('Edit your bio', 'Bio', bio, {
            max_length: 500,
            placeholder: 'What are your current projects? What made you happy recently (outside of projects)?'
          })
        bot.replyWithDialog(reply, dialog.asObject(), function (err) {
          if (err) {
            const text = log('the dialog creation', err)
            convo.say(text)
            convo.stop()
            convo.next()
          }
          controller.on('dialog_submission', function (bot, { user, submission }) {
            bot.dialogOk()
            saveProfile(user, submission)
              .then((isUpdated) => {
                if (isUpdated === true) {
                  convo.gotoThread('profile_freshed')
                } else {
                  convo.gotoThread(nextThread)
                }
                convo.next()
              })
              .catch(err => {
                log('the `saveProfile` method', err)
                convo.stop()
                convo.next()
              })
          })
        })
      } else {
        convo.gotoThread(nextThread)
        convo.next()
      }
    }
  }, {}, 'search')

  convo.addMessage({
    text: 'Your profile has been freshed!',
    action: nextThread
  }, 'profile_freshed')
}
