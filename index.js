(function(){
"use strict";

function fileExists(filePath)
{
    try
    {
        return fs.statSync(filePath).isFile();
    }
    catch (err)
    {
        return false;
    }
}

if(fileExists('.env')) require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const firebase = require('firebase');
const _ = require('lodash');
const co = require('co');
const rp = require('request-promise');

class TTC {
    constructor() {
        this.config = {
            channel: process.env.TELEGRAM_CHANNEL,
            tc_api: 'https://api.topcoder.com/v2/challenges/active?review=COMMUNITY,INTERNAL,PEER&type=develop',
            email: process.env.FIREBASE_USER,
            password: process.env.FIREBASE_PASSWORD
        }
        this.init();
        this.challenges;
    }

    init() {
        console.log(`Starting! ${new Date}`)
        const _self = this;
        _self.bot = new TelegramBot(process.env.TELEGRAM_API_KEY, {polling: true});
        firebase.initializeApp({apiKey: process.env.FIREBASE_API_KEY, authDomain: process.env.AUTH_DOMAIN, databaseURL: process.env.FIREBASE_URL, storageBucket: process.env.BUCKET});
        _self.db = firebase.database().ref('challenges');

        co(function*(){
            yield firebase.auth().signInWithEmailAndPassword(_self.config.email, _self.config.password);
            _self.response = yield rp.get({json:true, url:_self.config.tc_api});
            _self.chs = {};
            var keys = [];
            _.each(_self.response.data, (ch)=>{
                _self.chs[ch.challengeId] = ch;


                keys.push(ch.challengeId);
            });

            const existing = yield _self.db.once('value');
            _self.difference = _.difference(keys, _self._getChallengeKeys(existing.val()));

            if(!_self.difference.length){
                console.log('No changes!');
                process.exit(0);
            }

            yield _self.db.set(_self.chs);
            yield _self._send(_self.difference.map((v)=>_self.chs[v]));
            console.log('Done!')
            process.exit(0);
        }).catch((e)=>{
            console.error(e);
            process.exit(1);
        });
    }

    _getChallengeKeys(obj) {
        var keys = [];
        _.each(obj, (v, k)=>{
            keys.push(parseInt(k))
        });
        return keys;
    }

    /*
    { challengeCommunity: 'develop',
         challengeId: 30055112,
         challengeName: 'Dinnaco - Request List Tool Sharepoint Misc Enhancements Challenge-1',
         challengeType: 'Code',
         checkpointSubmissionEndDate: '',
         currentPhaseEndDate: '2016-09-05T12:00:00.000-04:00',
         currentPhaseName: 'Registration',
         currentPhaseRemainingTime: 427050,
         eventId: 3446,
         eventName: 'tco16',
         firstPlacePrize: 1200,
         forumId: 33906,
         isPrivate: false,
         numRegistrants: 6,
         numSubmissions: 0,
         numberOfCheckpointsPrizes: 0,
         platforms: [ 'Microsoft Azure', 'Other' ],
         registrationEndDate: '2016-09-05T12:00:00.000-04:00',
         registrationOpen: 'Yes',
         registrationStartDate: '2016-08-31T12:00:00.000-04:00',
         reliabilityBonus: 240,
         reviewType: 'COMMUNITY',
         status: 'Active',
         submissionEndDate: '2016-09-05T12:00:00.000-04:00',
         technologies: [ '.NET', 'C#' ],
         totalPrize: 1800 } }
    */
    _send(arr) {
        var _self = this;
        var promiseArray = [];
        _.each(arr, (o)=> {
            var msg = `
            [${o.challengeType}] - ${o.challengeName}
            Prize: $${o.firstPlacePrize}
            Link: http://www.topcoder.com/challenge-details/${o.challengeId}?type=develop&lc=
            =====
            Forum: http://apps.topcoder.com/forums/?module=Category&categoryID=${o.forumId}
            =====
            Review: https://software.topcoder.com/review/actions/ViewProjectDetails?pid=${o.challengeId}
            `
            promiseArray.push(_self.bot.sendMessage(_self.config.channel, msg));
        });
        return promiseArray;
    }
}

var bot = new TTC();
// bot._send('hello');
})();
