/* 테스트가 읽는 데이터 — 앱과 같은 것을 보게 한다.
   off 가 붙은 선지·제시문은 아직 풀지 않은 회차라 build.py 가 앱에 넣지 않는다.
   출제기를 흉내 내는 테스트도 똑같이 빼야 앱과 어긋나지 않는다.
   데이터 자체의 품질은 test_data.js 가 off 까지 포함해 따로 본다. */
const fs = require('fs');
const APP = __dirname + '/..';
function read(fn, withOff){
  const all = JSON.parse(fs.readFileSync(APP + '/' + fn, 'utf8'));
  return withOff ? all : all.filter(x=> !x.off);
}
module.exports = { read: read, APP: APP };
