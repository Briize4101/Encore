export function raffleStatus(window,now=Date.now()){const start=Date.parse(window.start),end=Date.parse(window.end);if(now>end)return '已截止';if(now>=start)return end-now<=86400000?'24 小時內截止':'受理中';return start-now<=86400000?'24 小時內開始':'尚未開始';}
export function raffleTime(value,zone='Asia/Tokyo'){return new Intl.DateTimeFormat('zh-TW',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));}

