const AWS = require('aws-sdk');
const transcribe = new AWS.TranscribeService();

exports.handler =  async function(event, context) {
  if (event.Records) {
    for (let record of event.Records) {
      const s3 = record.s3;
      console.log(JSON.stringify(s3, null, 2));
      const bucket = s3.bucket.name;
      const key = s3.object.key;

      if (key.toLowerCase().endsWith(".amr") || key.toLowerCase().endsWith(".flac") ||
	  key.toLowerCase().endsWith(".mp3") || key.toLowerCase().endsWith(".mp4") ||
	  key.toLowerCase().endsWith(".ogg") || key.toLowerCase().endsWith(".webm") ||
	  key.toLowerCase().endsWith(".wav")) {

	// check for "##people" in the file name and set the person scanner to that number
	// default to 10 people if not found
	const matched = key.match(/(\d{1,2})(?=people)/);
	const numPeople = (matched && matched[0] && parseInt(matched[0])) || 10;

	const name = key.split("/").pop().replace(/[^0-9a-zA-Z._-]/g, '');
	
	await transcribe.startTranscriptionJob({
	  Media: {
	    MediaFileUri: "s3://" + bucket + "/" + key
	  },
	  TranscriptionJobName: "autotranscribe-" + name,
	  LanguageCode: "en-US",
	  OutputBucketName: bucket,
	  OutputKey: key.replace(/input/g, "output").replace(/[^a-zA-Z0-9-_.!*'()/]/g, '') + ".json",
	  /* JobExecutionSettings: {
	    AllowDeferredExecution: true,
	    DataAccessRoleArn: process.env.TRANSCRIBE_ROLE
	  }, */
	  Settings: {
	    ShowSpeakerLabels: true,
	    MaxSpeakerLabels: numPeople
	  }
	}).promise();
      } else {
	console.log("Invalid filetype: " + key.split(".").pop());
      }
    }
  }
};
