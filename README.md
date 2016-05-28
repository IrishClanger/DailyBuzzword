# Daily Buzzword
Daily Buzzword Alexa Skill developed in node.js using the Alexa Skills Kit. Tested with Alexa Voice Services on a Raspberry Pi 2 and 3.

This Amazon Alexa skill reads out the definition of the Merriam-Webster Inc. Daily Buzzword from their http://www.wordcentral.com/buzzword/archive.php website. Optionally it reads out an example usage of the word and a quiz related to the word.
In the quiz, saying "The answer is B" for example, helps Alexa to hear better than just saying "B" on its own. You can say "pass" if you do not know the answer, or just have a guess for fun.
You can say "repeat" at most stages to hear a section again.
This buzzword is more suitable for younger humanoids or those learning English.
This skill is not written by Merriam-Webster Inc. so errors or omissions are probably my own.

The node.js source code files AlexaSkill.js and index.js need to be zipped and uploaded into an AWS Lambda function as per the guidance at https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/developing-an-alexa-skill-as-a-lambda-function. A corresponding custom skill needs to be created as per https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/registering-and-managing-alexa-skills-in-the-developer-portal.

The intents, custom slot types and sample utterances should be copied from the corresponding files into the custom skill and compiled.
