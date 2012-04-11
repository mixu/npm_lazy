function tsPad(n){
  return n < 10 ? '0' + n : n.toString(10);
}

module.exports = function timestamp(){
    var ts = new Date,
        date = [ts.getMonth()+1, ts.getDate(), ts.getFullYear()].map(tsPad).join('.'),
        time = [ts.getHours(), ts.getMinutes(), ts.getSeconds(), ts.getMilliseconds()].map(tsPad).join(':');

    return date + ' ' + time+' ';
};

