import { NativeModules, NativeEventEmitter } from 'react-native';
import atob from 'atob/node-atob.js';
const { RNLiveAudioStream } = NativeModules;
const EventEmitter = RNLiveAudioStream && new NativeEventEmitter(RNLiveAudioStream);

const AudioRecord = {};

AudioRecord.init = options => RNLiveAudioStream.init(options);
AudioRecord.start = () => RNLiveAudioStream.start();
AudioRecord.stop = () => RNLiveAudioStream.stop();

const eventsMap = {
  data: 'data'
};

AudioRecord.on = (event, callback) => {
  const nativeEvent = eventsMap[event];
  if (!nativeEvent) {
    throw new Error('Invalid event');
  }
  EventEmitter.removeAllListeners(nativeEvent);
  return EventEmitter.addListener(nativeEvent, callback);
};

export default AudioRecord;

// ref to PowerLevel() in
// https://github.com/xiangyuecn/Recorder/blob/master/src/recorder-core.js
//
// e.g.
// const {pcmData, sum} = NativeRecordReceivePCM(pcmDataBase64);
// const powerLevel = PowerLevel(sum, pcmData.length);
//
/*计算音量百分比的一个方法
pcmAbsSum: pcm Int16所有采样的绝对值的和
pcmLength: pcm长度
返回值：0-100，主要当做百分比用
注意：这个不是分贝，因此没用volume当做名称*/
function PowerLevel(pcmAbsSum, pcmLength) {
  /*计算音量 https://blog.csdn.net/jody1989/article/details/73480259
  更高灵敏度算法:
    限定最大感应值10000
      线性曲线：低音量不友好
        power/10000*100
      对数曲线：低音量友好，但需限定最低感应值
        (1+Math.log10(power/10000))*100
  */
  var power = pcmAbsSum / pcmLength || 0; //NaN
  var level;
  if (power < 1251) {
    //1250的结果10%，更小的音量采用线性取值
    level = Math.round((power / 1250) * 10);
  } else {
    level = Math.round(
      Math.min(
        100,
        Math.max(0, (1 + Math.log(power / 10000) / Math.log(10)) * 100),
      ),
    );
  }
  return level;
}

// ref to PowerDBFS() in
// https://github.com/xiangyuecn/Recorder/blob/master/src/recorder-core.js
/*计算音量，单位dBFS（满刻度相对电平）
maxSample: 为16位pcm采样的绝对值中最大的一个（计算峰值音量），或者为pcm中所有采样的绝对值的平局值
返回值：-100~0 （最大值0dB，最小值-100代替-∞）
*/
function PowerDBFS(maxSample) {
  var val = Math.max(0.1, maxSample || 0),
    Pref = 0x7fff;
  val = Math.min(val, Pref);
  //https://www.logiclocmusic.com/can-you-tell-the-decibel/
  //https://blog.csdn.net/qq_17256689/article/details/120442510
  val = (20 * Math.log(val / Pref)) / Math.log(10);
  return Math.max(-100, Math.round(val));
}

// ref to NativeRecordReceivePCM() in
// https://github.com/xiangyuecn/Recorder/blob/master/src/app-support/app-native-support.js
function NativeRecordReceivePCM(pcmDataBase64) {
  let bstr = atob(pcmDataBase64);
  let n = bstr.length;
  var pcm = new Int16Array(n / 2);
  var sum = 0;
  for (var idx = 0, s, i = 0; i + 2 <= n; idx++, i += 2) {
    s = ((bstr.charCodeAt(i) | (bstr.charCodeAt(i + 1) << 8)) << 16) >> 16;
    pcm[idx] = s;
    sum += Math.abs(s);
  }

  return {pcmData: pcm, sum};
}

// ref to envIn() in
// https://github.com/xiangyuecn/Recorder/blob/master/src/recorder-core.js
// ref to onProcess() in
// https://github.com/xiangyuecn/Recorder/blob/master/app-support-sample/index.html
// ref to FrequencyHistogramView.input() in
// https://github.com/xiangyuecn/Recorder/blob/1.2.23070100/src/extensions/frequency.histogram.view.js
//
// e.g.
// const optionsOfLiveAudioStream = {
//   sampleRate: 32000,  // default is 44100 but 32000 is adequate for accurate voice recognition
//   channels: 1,        // 1 or 2, default 1
//   bitsPerSample: 16,  // 8 or 16, default 16
//   audioSource: 6,     // android only (see below)
//   bufferSize: 4096    // default is 2048
// };
//
// LiveAudioStream.init(optionsOfLiveAudioStream);
//
// const histogramSet = {
//   canvas, // e.g. https://github.com/flyskywhy/react-native-gcanvas
//   ctx,
//   lineCount: 20,
//   minHeight: 1,
//   stripeEnable: false,
// };
// const histogram = FrequencyHistogramView(histogramSet);
//
// LiveAudioStream.on('data', pcmDataBase64 => {
//   const {pcmData, sum} = NativeRecordReceivePCM(pcmDataBase64);
//   histogram.input(
//     pcmData,
//     0 /* powerLevel, useless in histogram */,
//     optionsOfLiveAudioStream.sampleRate,
//   );
// });
// LiveAudioStream.start();
import FrequencyHistogramView from './frequency.histogram.view';

export {PowerLevel, PowerDBFS, NativeRecordReceivePCM, FrequencyHistogramView};
