const fs = require("fs");
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

function objToText(tobj) {
  let sum_string = "";
  
  if (tobj.results.speaker_labels) {
    let c_speaker = "";
    let pos = 0;
    for (const label of tobj.results.speaker_labels.segments) {
      if (label.speaker_label != c_speaker) {
	c_speaker = label.speaker_label;
	let st = parseFloat(label.start_time);
	let timestamp = "[" + String(Math.floor(st / 3600)) + ":" +
	    String(Math.floor(st / 60) % 60).padStart(2, "0") + ":" +
	    String(Math.round(st % 60)).padStart(2, "0") + "]";
	sum_string = sum_string + `\n${timestamp} ${c_speaker}:`;
      }
      
      while (true) {
	let item = tobj.results.items[pos];

	if (!item) {
	  console.log("not @ " + pos);
	  break;
	}
	
	if (item.start_time && parseFloat(label.end_time) < parseFloat(item.start_time))
	  break;
	
	if (item.alternatives[0].content == ","
	    || item.alternatives[0].content == ".") {
	  sum_string = sum_string + item.alternatives[0].content;
	} else {
	  sum_string = sum_string + " " + item.alternatives[0].content;
	}

	pos++;
      }
    }
  } else {
    for (const item of tobj.results.items) {
      if (item.alternatives[0].content == '.') {
	sum_string = sum_string + ".\n";
      } else {
	sum_string = sum_string + " " + item.alternatives[0].content;
      }
    }
  }

  return sum_string;
}

//   PAD NUMBER WITH ZEROES
//   NUM : THE ORIGINAL NUMBER
//   LEAD : TOTAL NUMBER OF DIGITALS ALLOWED (WHOLE NUMBERS)
//   TRAIL : TOTAL NUMBER OF DIGITALS ALLOWED (DECIMAL NUMBERS)
function padZero (num, lead, trail) {
  // CONVERT NUMBER TO STRING
  var cString = num.toString();

  // GET NUMBER OF DIGITS
  var cWhole, cDec, cCheck = cString.indexOf(".");

  // NO DECIMAL PLACES, A WHOLE NUMBER
  if (cCheck == -1) {
    cWhole = cString.length;
    cDec = 0;
    cString += ".";
  }
  // IS A DECIMAL NUMBER
  else {
    cWhole = cCheck;
    cDec = cString.substr(cCheck+1).length;
  }

  // (A3) PAD WITH LEADING ZEROES
  if (cWhole < lead) {
    for (let i=cWhole; i<lead; i++) { cString = "0" + cString; }
  }

  // (A4) PAD WITH TRAILING ZEROES
  if (cDec < trail) {
    for (let i=cDec; i<trail; i++) { cString += "0"; }
  }

  return cString;
}

exports.handler =  async function(event, context) {
  // console.log(JSON.stringify(event, null, 2));
  // ensure this is the right event type
  if (event.Records) {
    const ret = [];
    // loop through each record (even though there is probably only one)
    for (const r of event.Records) {
      const bucket = r.s3.bucket.name;
      const key = r.s3.object.key;
      // download json
      const obj = await s3.getObject({
	Bucket: bucket,
	Key: key
      }).promise();
      // convert json file to txt file
      const tsResults = JSON.parse(obj.Body.toString());
      const tsString = objToText(tsResults);
      // upload txt file back to s3
      ret.push(s3.putObject({
	Bucket: process.env.BUCKET,
	Key: key.replace(/output/g, "transcriptions").replace(/\.json/g, ".txt"),
	Body: Buffer.from(tsString)
      }).promise());
    }
    // return a sum Promise
    return Promise.all(ret);
  } else {
    console.log("ERROR: Not an S3 event!");
  }
};
