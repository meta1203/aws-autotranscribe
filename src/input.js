const AWS = require('aws-sdk');
const transcribe = new AWS.TranscribeService();

exports.handler =  async function(event, context) {
  let values = [];
  // S3 event
  if (event.Records) {
    for (let record of event.Records) {
      console.log(JSON.stringify(s3, null, 2));
      
      values.push({
	bucket: record.s3.bucket.name,
	key: record.s3.object.key,
      });
    }
  } else if (event.bucket && event.key) {
    values.push({
      bucket: event.bucket,
      key: event.key,
    });
  } else if (event.uri) {
    values.push({
      // get bucket value from URI
      bucket: event.uri.match(/(?<=s3:\/\/)(.+?)(?=\/)/g)[0],
      // get key value from URI
      key: event.uri.match(/(?<=s3:\/\/.+?\/).*/g)[0],
    });
  } else if (event.objects) {
    for (let obj of event.objects) {
      values.push({
	bucket: obj.bucket,
	key: obj.key,
      });
    }
  }

  for (let obj of values) {
    const key = obj.key
    const bucket = obj.bucket;
    
    if (key.toLowerCase().endsWith(".amr") || key.toLowerCase().endsWith(".flac") ||
	key.toLowerCase().endsWith(".mp3") || key.toLowerCase().endsWith(".mp4") ||
	key.toLowerCase().endsWith(".ogg") || key.toLowerCase().endsWith(".webm") ||
	key.toLowerCase().endsWith(".wav")) {

      let config = {
	Media: {
	  MediaFileUri: "s3://" + bucket + "/" + key
	},
	TranscriptionJobName: "autotranscribe-" + name,
	LanguageCode: "en-US",
	OutputBucketName: bucket,
	OutputKey: key.replace(/input/g, "output").replace(/[^a-zA-Z0-9-_.!*'()/]/g, '') + ".json",
      };

      // check for "##people" in the file name and set the person scanner to that number
      // default to single speaker if not found
      const matched = key.match(/(\d{1,2})(?=people)/);
      const numPeople = (matched && matched[0] && parseInt(matched[0])) || 0;
      if (numPeople) config.Settings = {
	ShowSpeakerLabels: true,
	MaxSpeakerLabels: numPeople,
      };

      const name = key.split("/").pop().replace(/[^0-9a-zA-Z._-]/g, '');
      
      await transcribe.startTranscriptionJob(config).promise();
    } else {
      console.log("Invalid filetype: " + key.split(".").pop());
    }
  }
};
