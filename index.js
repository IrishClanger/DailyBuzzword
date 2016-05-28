/**
 * This program uses a Lambda function for handling Alexa Skill requests that:
 *
 * - Web page: parse an external web page to get the daily buzzword (Merriam-Webster Daily Buzzword web page).
 *   an optional sample usage of the word, and an optional quiz about the word.
 * - SSML: Using SSML tags to control how Alexa renders the text-to-speech.
 * - Session management: uses a sessions state variable to keep track of progress through the stages.
 */

'use strict';

/**
 * App ID for the skill
 */
var APP_ID = 'amzn1.echo-sdk-ams.app.PutYourAppIdHereFromTheSkillInformationPageOfTheDeveloperConsole'; 

var http = require('http');

/**
 * The AlexaSkill Module that has the AlexaSkill prototype and helper functions
 */
var AlexaSkill = require('./AlexaSkill');

/**
 * Buzzword is a child of AlexaSkill.
 */
var Buzzword = function () {
    AlexaSkill.call(this, APP_ID);
};

// Extend AlexaSkill
Buzzword.prototype = Object.create(AlexaSkill.prototype);
Buzzword.prototype.constructor = Buzzword;

Buzzword.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
    console.log("Buzzword onSessionStarted requestId: " + sessionStartedRequest.requestId
        + ", sessionId: " + session.sessionId);
    // any initialization logic goes here
};

Buzzword.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
    console.log("Buzzword onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);
    // Always read the daily buzzword on launch.
    handleNewBuzzwordRequest(launchRequest, session, response);
};

/**
 * Overridden to show that a subclass can override this function to teardown session state.
 */
Buzzword.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session) {
    console.log("Buzzword onSessionEnded requestId: " + sessionEndedRequest.requestId
        + ", sessionId: " + session.sessionId);
    // any cleanup logic goes here
};

Buzzword.prototype.intentHandlers = {
    "GetBuzzwordIntent": function (intent, session, response) {
        handleNewBuzzwordRequest(intent, session, response);
    },

    "AMAZON.YesIntent": function (intent, session, response) {
        // Process the Yes event unless we are at the quiz answer stage in which case read the help.
        if (session.attributes.stage != 3) {
            handleYesEventRequest(intent, session, response);
        } else {
            handleHelpRequest(intent, session, response);
        }
    },

    "AMAZON.NoIntent": function (intent, session, response) {
        // Process the No event unless we are at the quiz answer stage in which case read the help.
        if (session.attributes.stage != 3) {
            handleNoEventRequest(intent, session, response);
        } else {
            handleHelpRequest(intent, session, response);
        }
    },

    "GetQuizAnswerIntent": function (intent, session, response) {
        // If we are not at the quiz answer stage then read the help for the current stage.
        if (session.attributes.stage === 3) {
            scoreQuiz(intent, session, response);
        } else {
            handleHelpRequest(intent, session, response);
        }
    },

    "GetPassIntent": function (intent, session, response) {
        // If we are not at the quiz answer stage then read the help for the current stage.
        if (session.attributes.stage === 3) {
            passQuiz(intent, session, response);
        } else {
            handleHelpRequest(intent, session, response);
        }
    },

    "AMAZON.HelpIntent": function (intent, session, response) {
        handleHelpRequest(intent, session, response);
    },

    "AMAZON.RepeatIntent": function (intent, session, response) {
        console.log("Repeat stage: " + session.attributes.stage);
        // Repeat the appropriate stage on request.
        switch(session.attributes.stage) {
            case 1:
                repeatBuzzwordRequest(intent, session, response);
                break;
            case 2:
                readUsage(intent, session, response);
                break;
            case 3:
                readQuiz(intent, session, response);
                break;
            default:
                handleHelpRequest(intent, session, response);
        }
    },

    "AMAZON.StopIntent": function (intent, session, response) {
        var speechOutput = {
            speech: "<speak>See you later alligator.</speak>",
            type: AlexaSkill.speechOutputType.SSML
        };
        response.tell(speechOutput);
    },

    "AMAZON.CancelIntent": function (intent, session, response) {
		var speechOutput = {
            speech: "<speak>See you later alligator.</speak>",
            type: AlexaSkill.speechOutputType.SSML
        };
        response.tell(speechOutput);
    }
};

/**
 * Gets the daily buzzword and returns to the user, then asks if they want to hear the example usage.
 */
function handleNewBuzzwordRequest(intent, session, response) {
    var sessionAttributes = {},
        cardContent = "",   
        cardTitle = "Daily Buzzword: ",
        prefixText = "The Daily Buzzword from Merriam-Webster. ",
        repromptText = "",
        i = 0;   

    console.log("Entered handleNewBuzzwordRequest");
            
    getPageSourceFromMerriamWebster(function (result) {
        var speechText = "";

        sessionAttributes.text = result;
        session.attributes = sessionAttributes;
        if (result.length === 0) {
            speechText = "There is a problem connecting to Merriam-Webster at this time. Please try again later.";
            response.tell(speechText);
        } else {
            // The stage variable tracks the phase of the dialogue. 
            // When this function completes, it will be on stage 1.
            session.attributes.stage = 1;

            cardTitle += result[0] + ".";
            // Add the buzzword first as we don't want to add a space after it. Capitalise it on the card.
            cardContent = result[0].charAt(0).toUpperCase() + result[0].substring(1, result[0].length);
            speechText = result[0];
            // Add the remaining words to the card stopping when we reach the #USAGE# marker.
            i = 1;
            while (result[i] !== '#USAGE#') {
                console.log("result " + result[i]);
                cardContent += result[i] + " ";
                speechText += result[i] + " ";
                i++;
            }
            // Set the session index to the next entry to get the example usage.
            sessionAttributes.index = i + 1;

            // The usage variable stores the index of the usage example. 
            session.attributes.usage = sessionAttributes.index;

            console.log("sessionAttributes.index " + sessionAttributes.index);
            console.log("Example usage " + sessionAttributes.text[sessionAttributes.index]);

            // Change the last comma to a full stop so the card grammar is correct.
            cardContent = cardContent.substring(0, cardContent.lastIndexOf(",")) + ".";
            // Spell out the word as well
            speechText += '<break time="500ms"/>' + result[0] + " is spelt " + '<say-as interpret-as="spell-out">' + result[0] + "</say-as>";
            speechText += " <p>Do you want an example of how to use " + result[0] + "?" + "</p>";
            repromptText = "Do you want an example of how to use " + result[0] + "?";
            var speechOutput = {
                speech: "<speak>" + prefixText + speechText + "</speak>",
                type: AlexaSkill.speechOutputType.SSML
            };
            var repromptOutput = {
                speech: repromptText,
                type: AlexaSkill.speechOutputType.PLAIN_TEXT
            };
            response.askWithCard(speechOutput, repromptOutput, cardTitle, cardContent);
        }
    });
}

/**
 * Processes Yes events for each additional stage and calls the required functions.
 */
function handleYesEventRequest(intent, session, response) {
    var sessionAttributes = session.attributes,
        result = sessionAttributes.text,
        speechText = "",
	repromptText = "Do you want a quiz for this word?",
        speechOutput = "",
        repromptOutput = "";

    console.log("Entered handleYesEventRequest");
    console.log("result " + result);
    console.log("stage " + session.attributes.stage);
    
	if (session.attributes.stage) {
    	switch(session.attributes.stage) {
    		case 1: 
        		// Read out the usage.
        		readUsage(intent, session, response);
        		break;
    		case 2 :
		         // Read out the quiz if at this stage and the user has not said no.
		        readQuiz(intent, session, response);
		        break;
    		case 3 :
        		// Stage 3, the quiz answer, should not get here but just in case deal with it.
        		speechText = "Which letter is the answer, or say pass?";

        		speechOutput = {
            		speech: "<speak>" + speechText + "</speak>",
            		type: AlexaSkill.speechOutputType.SSML
       			};
            	response.ask(speechOutput, speechOutput);
            	break;
			case 4 :
	           	// Read out the explanation if at this stage and the user has not said no.
		        readExplanation(intent, session, response);
		        break;
		}
	} else {
        // If the session attributes are not found, then restart.
        speechText = "Sorry, I lost my place. Say get the buzzword to start again or say exit to quit.";

        repromptText = "Say get the buzzword to start again or say exit to quit.";

        speechOutput = {
            speech: "<speak>" + speechText + "</speak>",
            type: AlexaSkill.speechOutputType.SSML
        };
        repromptOutput = {
           speech: repromptText,
           type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.ask(speechOutput, repromptOutput);
    }
}

/**
 * Processes No events for each additional stage and calls the required functions.
 */
function handleNoEventRequest(intent, session, response) {
    var sessionAttributes = session.attributes,
        result = sessionAttributes.text,
        speechText = "",
	repromptText = "Do you want a quiz for this word?",
        speechOutput = "",
        repromptOutput = "";

    console.log("Entered handleNoEventRequest");
    console.log("result " + result);
    console.log("stage " + session.attributes.stage);
    
	if (session.attributes.stage) {
		switch(session.attributes.stage) {
		case 1:
           		// If the user said no then advance the stage of the dialogue.
		        session.attributes.stage = 2;
    		    	console.log("stage set to 2 " + session.attributes.stage);

        		speechText = "Do you want a quiz for " + result[0] + "?";
        		repromptText = "Do you want a quiz for " + result[0] + "?";

        		speechOutput = {
            		speech: "<speak>" + speechText + "</speak>",
            		type: AlexaSkill.speechOutputType.SSML
        		};
        		repromptOutput = {
           			speech: repromptText,
           			type: AlexaSkill.speechOutputType.PLAIN_TEXT
        		};
        		response.ask(speechOutput, repromptOutput);
        		break;
		case 2:
		     	// If the user said no then finish.
        		speechText = "See you later alligator.";

        		speechOutput = {
            		speech: "<speak>" + speechText + "</speak>",
            		type: AlexaSkill.speechOutputType.SSML
        		};
        		response.tell(speechOutput);
        		break;
		case 3:
            		// Stage 3, the quiz answer, should not get here but just in case deal with it.
     			speechText = "Which letter is the answer, or say pass?";

  		    	speechOutput = {
            		speech: "<speak>" + speechText + "</speak>",
            		type: AlexaSkill.speechOutputType.SSML
        		};
        		response.ask(speechOutput, speechOutput);
        		break;
		case 4:
	            	// If the user said no then write out the (often long) explanation to the card for completeness.
    	        	writeExplanation(intent, session, response);
    	        	break;
    	}
    } else {
        // If the session attributes are not found, then restart.
        speechText = "Sorry, I lost my place. Say get the buzzword to start again or say exit to quit.";

        repromptText = "Say get the buzzword to start again or say exit to quit.";

        speechOutput = {
            speech: "<speak>" + speechText + "</speak>",
            type: AlexaSkill.speechOutputType.SSML
        };
        repromptOutput = {
           speech: repromptText,
           type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.ask(speechOutput, repromptOutput);
    }
}

/**
 * Reads the example usage of the buzzword and asks if the user wants a quiz related to the word.
 */
function readUsage(intent, session, response) {
    var sessionAttributes = session.attributes,
        result = sessionAttributes.text,
        cardTitle = "Example usage of " + result[0] + ".",
        speechText = "",
        cardContent = "",
        repromptText = "Do you want a quiz for " + result[0] + "?",
        charCode = 0;

    console.log("Entered readUsage");

    // Advance the stage of the dialogue.
    session.attributes.stage = 2;
    console.log("stage set to 2 " + session.attributes.stage);

    // If not already done so, record the index point for the usage.
    if (!session.attributes.usage) {
        // Set the index to the next entry to get the example usage.
        sessionAttributes.index += 1;

        session.attributes.usage = sessionAttributes.index;

    } else {
        // If usage index already set then we are repeating so set the index start point.
        sessionAttributes.index = session.attributes.usage;
    }  

    console.log("sessionAttributes.index " + sessionAttributes.index);
    console.log("Example usage " + sessionAttributes.text[sessionAttributes.index]);

    if (!result[sessionAttributes.index]) {
        speechText = "There is no usage example for this word.";
        cardContent = speechText;
    } else {
        // Clean up the example usage text for speech and display.
        speechText = result[sessionAttributes.index];
        // Remove &quot; text
        speechText = speechText.replace(/\&quot;/g, "");
        // Replace an em-dash with a comma
        speechText = speechText.replace(/\&#8212;/g, ",");
        // Replace the single quote code with a single quote
        speechText = speechText.replace(/\&#8216;/g, "'");
        // Replace a double dash with a comma
        speechText = speechText.replace(/--/g, ", ");
        // Remove other four digit codes
        speechText = speechText.replace(/\&#[0-9][0-9][0-9][0-9];/g, "");
        // Replace a dash followed by a space with a comma and space (space needed to prevent replacing dash in a hypthenated word)
        speechText = speechText.replace(/- /g, ", ");
        // Replace any double commas we have with a single comma
        speechText = speechText.replace(/,,/g, ",");
        // Remove any underscores.
        speechText = speechText.replace(/_/g, "");
        // Convert any extended character codes to the correct foreign character.
        while (speechText.search(/\&#[1-2][0-9][0-9];/) !== -1) {
        	// Get the 3 digit character code.
        	charCode = speechText.substr((speechText.search(/\&#[1-2][0-9][0-9];/) + 2), 3);
        	// Replace the &#241; type code with the correct foreign character.
        	speechText = speechText.replace(/\&#[1-2][0-9][0-9];/, String.fromCharCode(charCode));
        }

        cardContent =  speechText;
        speechText =  "<p>" + speechText + "</p>" + '<break time="500ms"/>' + "Do you want a quiz for " + result[0] + "?";
    }
    var speechOutput = {
        speech: "<speak>" + speechText + "</speak>",
        type: AlexaSkill.speechOutputType.SSML
    };
    var repromptOutput = {
       speech: repromptText,
       type: AlexaSkill.speechOutputType.PLAIN_TEXT
   };
   response.askWithCard(speechOutput, repromptOutput, cardTitle, cardContent);
}

/**
 * Reads the quiz related to the buzzword and prompts for the answer.
 */
function readQuiz(intent, session, response) {
    var sessionAttributes = session.attributes,
        result = sessionAttributes.text,
        cardTitle = "Quiz for " + result[0] + ".",
        speechText = "",
        cardContent = "",
        repromptText = "Which letter is the answer? Say pass to give up.";

    console.log("Entered readQuiz");

    // If not already done so, initialise a guesses counter.
    if (!session.attributes.guesses) {
        session.attributes.guesses = 0;
    }

    // Advance the stage of the dialogue.
    session.attributes.stage = 3;
    console.log("stage set to 3 " + session.attributes.stage);

    // If not already done so, record the index point for the quiz.
    if (!session.attributes.quiz) {
        // Set the index to the next entry to get the quiz instructions.
        sessionAttributes.index += 1;

        session.attributes.quiz = sessionAttributes.index;

    } else {
        // If quiz index already set then we are repeating so set the index start point.
        sessionAttributes.index = session.attributes.quiz;
    }

    if (!result[sessionAttributes.index]) {
        speechText = "There is no quiz for this word.";
        cardContent = speechText;
    } else {
        speechText = cleanBrackets(result[sessionAttributes.index]);
        cardContent =  speechText;

        // Set the index to the next entry to get the possible answers.
        sessionAttributes.index += 1;

        //Initialise the validAnswers session variable.
        session.attributes.validAnswers = "";

        // Now append the possible answers.
        while (result[sessionAttributes.index] != "#ANSWER#"){
            // Record the valid answers.
            session.attributes.validAnswers += result[sessionAttributes.index].toLowerCase().charAt(0);
            console.log("Valid answers: ", session.attributes.validAnswers);

            // Add a . at the end of speechText only to make sure we get a pause between each answer.
            speechText += " " + cleanBrackets(result[sessionAttributes.index]) + ".";
            cardContent += "\n" + cleanBrackets(result[sessionAttributes.index]);
            sessionAttributes.index += 1;
        }

        speechText =  '<p>' + speechText + '</p><break time="300ms"/>Which letter is the answer?';
    }

    // Advance past the answer marker to the actual answer
    sessionAttributes.index += 1; 

    var speechOutput = {
        speech: "<speak>" + speechText + "</speak>",
        type: AlexaSkill.speechOutputType.SSML
    };
    var repromptOutput = {
       speech: repromptText,
       type: AlexaSkill.speechOutputType.PLAIN_TEXT
    };
    response.askWithCard(speechOutput, repromptOutput, cardTitle, cardContent);
}

/**
 * Processes the user's answers to the quiz and asks if they want to hear the explanation of the answer.
 */
function scoreQuiz(intent, session, response) {
    var sessionAttributes = session.attributes,
        result = sessionAttributes.text,
        cardTitle = "Answer for " + result[0] + ".",
        speechText = "",
        cardContent = "",
        quizAnswer = result[sessionAttributes.index],
        userAnswer = intent.slots.QuizAnswer.value,
        repromptText = "Do you want to hear the explanation?",
        numQuestions = 0,
        speechOutput = "",
        repromptOutput = "";

    console.log("Entered score quiz section" );

    // Reformat the quiz and user answers so they match ok if the same
    console.log("Full user answer: " + userAnswer);
    quizAnswer = quizAnswer.toLowerCase();
    userAnswer = userAnswer.toLowerCase().charAt(0);
    console.log("User answer: " + userAnswer);
    console.log("Quiz answer: " + quizAnswer);

    // Get the total numbers of questions from the array information.
    numQuestions = result[sessionAttributes.index + 1];
    console.log("Number of questions: " + numQuestions);

    // Check the quiz answer
    if (userAnswer === quizAnswer) {
        // Increase the guess count by 1.
        session.attributes.guesses += 1;
        console.log("Correct, guesses now: " + session.attributes.guesses);

        if (session.attributes.guesses === 1) {
            // Advance the stage of the dialogue.
            session.attributes.stage = 4;
            console.log("stage set to 4 " + session.attributes.stage);
            speechText = "Excellent, correct first try! Do you want to hear why?";
            cardContent = "Excellent, correct first try! The answer is " + quizAnswer.toUpperCase() + ".";
        } else {
            // Advance the stage of the dialogue.
            session.attributes.stage = 4;
            console.log("stage set to 4 " + session.attributes.stage);

            speechText = "Well done! Do you want to hear why?";
            cardContent = "Well done! The answer is " + quizAnswer.toUpperCase() + ".";
        }

        speechOutput = {
            speech: "<speak>" + speechText + "</speak>",
            type: AlexaSkill.speechOutputType.SSML
        };
        repromptOutput = {
           speech: repromptText,
           type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.askWithCard(speechOutput, repromptOutput, cardTitle, cardContent);

    } else if (session.attributes.validAnswers.indexOf(userAnswer) === -1) {
        // If the user answer is not one of the valid answers tell them and let them try again.
        console.log("Invalid, guesses now: " + session.attributes.guesses);

        speechText = userAnswer + " is not a valid choice. Which letter is the answer?";
        repromptText = "Which letter is the answer?";

        speechOutput = {
            speech: "<speak>" + speechText + "</speak>",
            type: AlexaSkill.speechOutputType.SSML
        };
        repromptOutput = {
           speech: repromptText,
           type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.ask(speechOutput, repromptOutput);

    } else if ((session.attributes.guesses + 2) >= numQuestions) {
        // We must add 2 here to check if all but one guesses have been made as we are only incrementing guesses
        // after the answer to ensure that only valid answers increase the guess count.
        // If the user has guessed all but one of the answers then tell them the answer.

        // Advance the stage of the dialogue.
        session.attributes.stage = 4;
        console.log("stage set to 4 " + session.attributes.stage);

        console.log("Bad luck, guesses now: " + session.attributes.guesses + 1);

        speechText = "Bad luck, the answer is " + quizAnswer + ". Do you want to hear why?";
        cardContent = "Bad luck, the answer is " + quizAnswer.toUpperCase() + ".";

        speechOutput = {
            speech: "<speak>" + speechText + "</speak>",
            type: AlexaSkill.speechOutputType.SSML
        };
        repromptOutput = {
           speech: repromptText,
           type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.askWithCard(speechOutput, repromptOutput, cardTitle, cardContent);

    } else {
        // User has given an incorrect, valid answer.
        // Increase the guess count by 1.
        session.attributes.guesses += 1;
        console.log("Incorrect, guesses now: " + session.attributes.guesses);

        speechText = "Incorrect. Which letter is the answer?";
        repromptText = "Which letter is the answer?";

        speechOutput = {
            speech: "<speak>" + speechText + "</speak>",
            type: AlexaSkill.speechOutputType.SSML
        };
        repromptOutput = {
           speech: repromptText,
           type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.ask(speechOutput, repromptOutput);
    }
}

/**
 * The user has passed so tell them the answer and ask if they want the explanation.
 */
function passQuiz(intent, session, response) {
    var sessionAttributes = session.attributes,
        result = sessionAttributes.text,
        cardTitle = "Answer for " + result[0] + ".",
        speechText = "",
        cardContent = "",
        quizAnswer = result[sessionAttributes.index],
        repromptText = "Do you want to hear the explanation?",
        speechOutput = "",
        repromptOutput = "";

    console.log("Entered passQuiz" );

    // Advance the stage of the dialogue.
    session.attributes.stage = 4;
    console.log("stage set to 4 " + session.attributes.stage);

    speechText = "The answer is " + quizAnswer + ". Do you want to hear why?";
    cardContent = "The answer is " + quizAnswer.toUpperCase() + ".";

    speechOutput = {
        speech: "<speak>" + speechText + "</speak>",
        type: AlexaSkill.speechOutputType.SSML
    };
    repromptOutput = {
       speech: repromptText,
       type: AlexaSkill.speechOutputType.PLAIN_TEXT
    };
    response.askWithCard(speechOutput, repromptOutput, cardTitle, cardContent);
}

/**
 * Reads the quiz answer explanation to the user and puts it on the card.
 */
function readExplanation(intent, session, response) {
    var sessionAttributes = session.attributes,
        result = sessionAttributes.text,
        cardTitle = "Explanation of the answer for " + result[0] + ".",
        speechText = "",
        cardContent = "",
        answerExplanation = "";

    console.log("Entered readExplanation");

    // Advance the stage of the dialogue.
    session.attributes.stage = 5;
    console.log("stage set to 5 " + session.attributes.stage);

    // Advance to the answer explanation skipping over the answer count.
    sessionAttributes.index += 2;
    answerExplanation = result[sessionAttributes.index];
    console.log("answerExplanation: " + answerExplanation);

    speechText = cleanBrackets(answerExplanation);

    console.log("Answer explanation: " + speechText);

    cardContent =  speechText;
    var speechOutput = {
        speech: '<speak>' + speechText + '<break time="500ms"/>See you later alligator.</speak>',
        type: AlexaSkill.speechOutputType.SSML
    };

    response.tellWithCard(speechOutput, cardTitle, cardContent);

}

/**
 * Writes the quiz answer explanation to the card without reading it out.
 */
function writeExplanation(intent, session, response) {
    var sessionAttributes = session.attributes,
        result = sessionAttributes.text,
        cardTitle = "Explanation of the answer for " + result[0] + ".",
        speechText = "",
        cardContent = "",
        answerExplanation = "";

    console.log("Entered writeExplanation");

    // Advance the stage of the dialogue.
    session.attributes.stage = 6;
    console.log("stage set to 6 " + session.attributes.stage);

    // Advance to the answer explanation skipping over the answer count.
    sessionAttributes.index += 2;
    answerExplanation = result[sessionAttributes.index];
    console.log("answerExplanation: " + answerExplanation);

    speechText = 'See the card for the explanation.';

    cardContent =  cleanBrackets(answerExplanation);
    var speechOutput = {
        speech: '<speak>' + speechText + '<break time="500ms"/>See you later alligator.</speak>',
        type: AlexaSkill.speechOutputType.SSML
    };

    response.tellWithCard(speechOutput, cardTitle, cardContent);
}

/**
 * Removes mark up text from a string.
 */
function cleanBrackets (inputString) {
    // Remove items bracketed by <> like <em> and <em/>
    // Remove <bracketed items>
    inputString = inputString.replace(/<[a-z]*\>/g, "");
    // Remove </bracketed items>
    inputString = inputString.replace(/<\/[a-z]*\>/g, "");
    // Remove any unusual characters we don't want
    inputString = inputString.replace(/[^a-zA-Z0-9 ,.\-\!?:'""]/g, " ");

    return inputString;
}

/**
 * Gets the page source from the web page.
 */
function getPageSourceFromMerriamWebster(eventCallback) {
    // URL to download daily buzzword from Merriam-Webster
    var url = 'http://www.wordcentral.com/buzzword/buzzword.php';
    // Use the 2 lines below to test the skill with random words from the archive for the month and year given.
    // var dayChoice = Math.floor((Math.random() * 31) + 1);
    // var url = 'http://www.wordcentral.com/buzzword/buzzword.php?month=01&day=' + dayChoice + '&year=2016';
    // Use the 3 lines below to test the skill with random words from the archive up to May 2016.
    // var dayChoice = Math.floor((Math.random() * 31) + 1);
    // var monthChoice = Math.floor((Math.random() * 5) + 1);
    // var url = 'http://www.wordcentral.com/buzzword/buzzword.php?month=' + monthChoice + '&day=' + dayChoice + '&year=2016';
    // Use the line below to test a particular date from the archive.
    // var url = 'http://www.wordcentral.com/buzzword/buzzword.php?month=04&day=15&year=2016';

    http.get(url, function(res) {
        var body = '';

        res.on('data', function (chunk) {
            body += chunk;
        });
   
        res.on('end', function () {
            console.log("body  " +  body);
            var stringResult = parseHTML(body);
            console.log("stringResult " + stringResult);
            eventCallback(stringResult);
        });
    }).on('error', function (e) {
        console.log("Got error: ", e);
    });
}

/**
 * Parse the page source filling an array with the various elements.
 */
function parseHTML(inputText) {
    // sizeOf (<dt class="hw">) is 15
    var text = inputText.substring(inputText.indexOf('<dt class="hw">')+15, inputText.indexOf('<div class="creative">')),
        retArr = [],
        startIndex = 0,
        endIndex = 0,
        partOfSpeech = "",
        eventText = "",
        entry = "",
        answerLetter = "",
        totalSenses = 0,
        endSense = 0,
        s = 0,
        m = 0,
        answer = 0;

    console.log("text: " + text);

    // Get daily buzzword
    entry = text.substring(0, text.indexOf("(")-1);
    retArr.push(entry);
    console.log("Buzzword " + entry);
    
    // Get part of speech
    startIndex = text.indexOf(">")+1;
    endIndex = (text.indexOf("</em>", startIndex));
    // Get the grammar correct so as not to teach bad habits!
    switch (text.charAt(startIndex)) {
        case "a":
        case "e":
        case "i":
        case "o":
        case "u":
        case "h":                
            partOfSpeech = ", as an ";
            break;
        default:                
            partOfSpeech = ", as a ";
            break;
    }
    partOfSpeech += text.substring(startIndex, endIndex) + ', means'; 
    retArr.push(partOfSpeech);
    console.log("partOfSpeech " + partOfSpeech);

    startIndex = endIndex;

    // Check whether it has multiple senses.
    totalSenses = text.lastIndexOf('<span class="sn">');
    console.log("totalSenses test " + totalSenses);

    // Deal with single and multiple definitions separately.
    if (totalSenses == -1) {
        console.log("Single sense");
        // Loop through the meanings.
        m = 1;
        while (text.indexOf("</strong> ", startIndex) != -1) {
            // Get one meaning.
            startIndex = text.indexOf("</strong> ", endIndex)+10;
            endIndex = text.indexOf("<", startIndex);
            eventText =  text.substring(startIndex, endIndex) + ",";
            console.log("Meaning " + m + ": " + eventText);
            retArr.push(eventText);
            m++;
        }
    } else {
        totalSenses = text.substring(totalSenses+17,text.indexOf("<",totalSenses+17));
        console.log("Multiple senses: " + totalSenses);
        // Loop through each sense using a while clause as the totalSenses method does not work in cases of sense 2 a then b.
        while ((text.indexOf('<span class="sn">', startIndex) != -1)) {
            startIndex = text.indexOf('<span class="sn">', startIndex) + 17;
            endIndex = text.indexOf('</span>', startIndex);
            s = text.substring(startIndex, endIndex);
            if (s.indexOf(' ') != -1) {
                // Truncate sense to just a number to deal with senses like "2 a".
                s = s.substring(0, s.indexOf(' '));
            }
            eventText = "in sense " + s + ",";
            retArr.push(eventText);
            // Loop through the meanings.
            m = 1;
            endSense = text.indexOf("</span></span>", endIndex+1);
            console.log("endSense " + endSense);
            while ((text.indexOf("</strong> ", startIndex) != -1) && (text.indexOf("</strong> ", endIndex) < endSense)) {
                // Get one meaning.
                startIndex = text.indexOf("</strong> ", endIndex)+10;
                endIndex = text.indexOf("<", startIndex);
                console.log("startIndex " + startIndex);
                console.log("endIndex " + endIndex);
                eventText = text.substring(startIndex, endIndex) + ",";
                console.log("Meaning " + m + ":" + eventText);
                retArr.push(eventText);
                m++;
            }
        }
    }
    
	// Mark the start of the usage section.
    retArr.push("#USAGE#");

    // Get the usage prefixing it so we know when we are at this point.
    startIndex = text.indexOf('<dd class="usage">', startIndex) + 18;
    endIndex = text.indexOf('</dd>', startIndex);
    eventText = text.substring(startIndex, endIndex);
    console.log("Usage:" + eventText);
    retArr.push(eventText);
    

    // Get the quiz instructions.
    startIndex = text.indexOf('<div class="inst">', startIndex) + 18;
    endIndex = text.indexOf('</div>', startIndex);
    eventText = text.substring(startIndex, endIndex);
    console.log("Quiz instructions:" + eventText);
    retArr.push(eventText);

    // Get the quiz questions recording the correct answer along the way.
    // Initialise question counter.
    s = 1;
	while ((text.indexOf('<div class="q">', startIndex) != -1)) {
		// See if this question is the correct answer.
		startIndex = text.indexOf('correct="', startIndex) + 9;
		endIndex = text.indexOf('"', startIndex);
		eventText = text.substring(startIndex, endIndex);
		if (eventText === "yes") {
	   		// This question is the correct answer so record that fact.
	   		answer = s;
		}

		// Find the next input label then get the text of the question.
		startIndex = text.indexOf('<label for="input_', startIndex) + 18;
		// Now find the question text that follows this label.
		startIndex = text.indexOf('">', startIndex) + 2;
		endIndex = text.indexOf('</label>', startIndex);
		eventText = text.substring(startIndex, endIndex);
		console.log("Question " + s + ": " + eventText);
		// Get the answer letter.
		if (answer === s) {
			answerLetter = eventText.substring(0,1);
			console.log("Answer: " + answerLetter);
		}
		retArr.push(eventText);
		s++;
	}

	// Record the answer now the questions are complete.
    retArr.push("#ANSWER#");
	retArr.push(answerLetter);
    // Keep track of the number of questions.
    retArr.push(s-1);

    // Get the answer explanation.
    startIndex = text.indexOf('<div class="oncomplete">', startIndex) + 24;
    endIndex = text.indexOf('</div>', startIndex);
    eventText = text.substring(startIndex, endIndex);
    console.log("Answer explanation:" + eventText);
    retArr.push(eventText);


    // Return the final array.
    return retArr;
}

/**
 * Give different help messages for each stage.
 */
function handleHelpRequest(intent, session, response) {
    var speechText = "",
        speechOutput = "",
        repromptText = "",
        repromptOutput = "";

    console.log("Entered handleHelpRequest");
    console.log("stage " + session.attributes.stage);

    switch (session.attributes.stage) {
        case 1:
            // Usage option.
            speechText = "Answer yes to hear the example usage or no to skip it. Say exit to quit. Do you want to hear the example usage?";
            repromptText =  "Answer yes, no or exit?";
            break;
        case 2:
            // Quiz option.
            speechText = "Answer yes to hear the quiz or no to skip it. Say exit to quit. Do you want to hear the quiz?";
            repromptText =  "Answer yes, no or exit?";
            break;
        case 3:
            // Answer the quiz.
            speechText = "For example you can say the answer is A, or say pass to give up. Say exit to quit. Which letter is the answer?";
            repromptText =  "Which letter is the answer, or say pass?";
            break;
        case 4:
            // Explanation option.
            speechText = "Answer yes to hear the often long explanation of the answer, or no to skip hearing it - it will be on a card anyway. Say exit to quit. Do you want to hear the explanation?";
            repromptText =  "Answer yes, no or exit?";
            break;
    }

    speechOutput = {
        speech: "<speak>" + speechText + "</speak>",
        type: AlexaSkill.speechOutputType.SSML
    };
    repromptOutput = {
       speech: repromptText,
       type: AlexaSkill.speechOutputType.PLAIN_TEXT
    };
    response.ask(speechOutput, repromptOutput);
}

/**
 * Repeats the daily buzzword, then asks if they want to hear the example usage.
 */
function repeatBuzzwordRequest(intent, session, response) {
    var sessionAttributes = session.attributes,
        result = sessionAttributes.text,
        cardContent = "",   
        cardTitle = "Daily Buzzword: ",
        prefixText = "The Daily Buzzword from Merriam-Webster. ",
        repromptText = "",
        i = 0,
        speechText = "";

    console.log("Entered repeatBuzzwordRequest");

    cardTitle += result[0] + ".";
    // Add the buzzword first as we don't want to add a space after it. Capitalise it on the card.
    cardContent = result[0].charAt(0).toUpperCase() + result[0].substring(1, result[0].length);
    speechText = result[0];
    // Add the remaining words to the card stopping when we reach the #USAGE# marker.
    i = 1;
    while (result[i] !== '#USAGE#') {
        console.log("result " + result[i]);
        cardContent += result[i] + " ";
        speechText += result[i] + " ";
        i++;
    }

    // Change the last comma to a full stop so the card grammar is correct.
    cardContent = cardContent.substring(0, cardContent.lastIndexOf(",")) + ".";
    // Spell out the word as well
    speechText += '<break time="500ms"/>' + result[0] + " is spelt " + '<say-as interpret-as="spell-out">' + result[0] + "</say-as>";
    speechText += " <p>Do you want an example of how to use " + result[0] + "?" + "</p>";
    repromptText = "Do you want an example of how to use " + result[0] + "?";
    var speechOutput = {
        speech: "<speak>" + prefixText + speechText + "</speak>",
        type: AlexaSkill.speechOutputType.SSML
    };
    var repromptOutput = {
        speech: repromptText,
        type: AlexaSkill.speechOutputType.PLAIN_TEXT
    };
    response.askWithCard(speechOutput, repromptOutput, cardTitle, cardContent);
}


    // Create the handler that responds to the Alexa Request.
    exports.handler = function (event, context) {
    // Create an instance of the Buzzword skill.
    var skill = new Buzzword();
    skill.execute(event, context);
};
