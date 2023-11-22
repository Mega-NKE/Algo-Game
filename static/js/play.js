const { AlgoCard } = require("algoCard");
const { ObjectArray_to_AlgoCardArray } = require("algoCard");
const ejs = require('ejs');

// IMPORTS
import * as Animations from './animations.js';
import * as HTMLCardCreator from './cardcreation.js';
import * as Helpers from './helpers.js';

var myHand = [];
var enemyHand = [];

var myTurn = undefined;
var ready = false;

var myGuessValue = 0;
var buttonValue = 0;
var selectedCard = 0;

var deckTop = undefined;

$(document).ready(function() {

    const readyButton = $('#ready-button');
    const you = $('#you');
    const enemy = $('#enemy');
    const dealer = $('#dealer');

    if(numberOfPlayersReady == 1) {
        enemy.addClass('player-ready');
    }

    window.history.pushState(null, '', `/${roomKey}/play`);

    Animations.initAnimations();
    
    // SOCKET.IO ONS AND EMITS

    var socket = io({
        query: {
            username: username,
            roomKey: roomKey,
        }
    });

    socket.on('lobbyUpdate', (roomData) => {
        if(roomData.users.length === 2) {
            var enemyuser = roomData.users[0].username;
            if(enemyuser === username) {
                enemyuser = roomData.users[1].username;
            }
            $('#enemy').html(enemyuser);
        }
        else {
            $('#enemy').html('...');
        }
    });

    socket.on('readyUpdate', (data) => {
        $('#ready-count').html(data.readyCount);

        var youUser = data.userList[0];

        if(data.userList.length !== 1) {
            var enemyUser = data.userList[1];

            if(youUser.username !== username) {
                [youUser, enemyUser] = [enemyUser, youUser];
            }

            if(enemyUser.ready) {
                enemy.addClass('player-ready');
            }
            else {
                enemy.removeClass('player-ready');
            }
        } else {
            enemy.removeClass('player-ready');
        }

        if(youUser.ready) {
            you.addClass('player-ready');
            readyButton.addClass('ready-status');
        }
        else {
            you.removeClass('player-ready');
            readyButton.removeClass('ready-status');
        }
    });

    socket.on('startGame', (data) => {
        $("header").addClass("header-out");
        $("footer").addClass("footer-out");
        $(".board").addClass("fade-out");

        setInterval(() => {
            $("header").addClass("display-none");
            $("footer").addClass("display-none");
            $(".board").addClass("display-none");

            $(".desk").addClass("fade-in");
            
            ready = false;
            enemy.removeClass('player-ready');
            you.removeClass('player-ready');
        }, 1400);

        myTurn = data.yourTurn;
        deckTop = new AlgoCard(data.deckTop.number, data.deckTop.color);
        setDeckTopDiv(deckTop);

        $('#yourHand').html('');
        $('#enemyHand').html('');
        myHand = ObjectArray_to_AlgoCardArray(data.yourHand);
        enemyHand = ObjectArray_to_AlgoCardArray(data.enemyHand);

        // add event listener ever time a single div is added to the hand.
        createHandDivsAndAddEventListenersToEnemyHand(myHand, enemyHand, socket);

        if(myTurn) {
            $('#yourHand').addClass('highlight-hand');
            dealer.addClass('highlight-dealer');
        } else {
            $('#enemyHand').addClass('highlight-hand');
            $('#pick-array').addClass('pick-inactive');
        }
        
        $('#yourGuessCallout').addClass('visibility-hidden');
    });

    socket.on('highlightCard', (data) => {
        var myHandDiv = document.querySelectorAll('.your-hand');

        myHandDiv[selectedCard].classList.remove('selected');
        selectedCard = data.index;
        myHandDiv[selectedCard].classList.add('selected');
        
        let calloutDiv = createAndDisplayCallout(selectedCard, myHand[selectedCard].getColor());

        Animations.hoverCalloutAnimation(calloutDiv);
    });

    socket.on('updateButtonValue', (data) => {
        buttonValue = data.buttonValue;
        updateCalloutValue(buttonValue);
    });

    socket.on('correctMove', (data) => {
        myTurn = data.yourTurn;
        var index = data.guessTarget;
        var enemyHandDivs = $('.enemy-hand');
        var myHandDivs = $('.your-hand');

        if(myTurn) {
            Animations.highlightFadeOutTo('correct', enemyHandDivs[index])

            $(enemyHandDivs[index]).html(myGuessValue);

            Animations.flipCardAnimation($($('.enemy-hand')[index]), enemyHand[index]);
        } else {
            $(myHandDivs[index]).removeClass('closed');
            $(myHandDivs[index]).addClass('open');

            Animations.highlightFadeOutTo('correct', myHandDivs[index]);
        }
    });

    socket.on('wrongMove', (data) => {
        const nextDeckTop = new AlgoCard(data.nextDeckTop.number, data.nextDeckTop.color);
        const insertIndex = data.insertIndex;
        var cardToInsert = deckTop;
        myTurn = data.yourTurn;

        if(!myTurn) {
            Animations.highlightFadeOutTo('wrong', $('.enemy-hand')[selectedCard]);

            myHand.splice(insertIndex, 0, cardToInsert);
            addCardDiv(cardToInsert, insertIndex, 'your', 'open', socket);
            $('#yourHand').removeClass('highlight-hand');
            $('#enemyHand').addClass('highlight-hand');
            $('#pick-array').addClass('pick-inactive');
            dealer.removeClass('highlight-dealer');
        } else {
            Animations.hightlightFadeOutTo('wrong', $('.your-hand')[selectedCard]);

            cardToInsert.setNumber(data.value);
            enemyHand.splice(insertIndex, 0, cardToInsert);
            addCardDiv(cardToInsert, insertIndex, 'enemy', 'open', socket);
            $('#yourHand').addClass('highlight-hand');
            $('#enemyHand').removeClass('highlight-hand');
            $('#pick-array').removeClass('pick-inactive');
            dealer.addClass('highlight-dealer');
            $('.guess-callout').remove();
        }

        setDeckTopDiv(nextDeckTop);
        deckTop = nextDeckTop;
    });

    socket.on('gameEnded', (data) => {
        var wonGame = data.wonGame;

        if(wonGame) {
            console.log('nice you win');
        } else {
            console.log('loser');
        }
    });

    // EVENT LISTENERS

    readyButton.click(() => {
        if(!ready) {
            ready = true;
        } else {
            ready = false;
        }
        socket.emit('readyConfirmation', { ready: ready });
    });

    dealer.click(() => {
        if(myTurn) {
            socket.emit('playMove', { guessTarget: selectedCard, guessValue: myGuessValue });
        }
    });

    var buttons = document.querySelectorAll('.pick-button');

    buttons.forEach(function (item, index) {
        item.addEventListener('click', function () {
            if(myTurn) {
                buttons[myGuessValue].classList.remove('button-selected');
                myGuessValue = index;
                buttons[myGuessValue].classList.add('button-selected');
                socket.emit('buttonClicked', { buttonValue: index });
            }
        });
    });
});


// Utility Functions

function createAndDisplayCallout(index, color) {
    if(!myTurn) {
        if($('.guess-callout')) {
            $('.guess-callout').remove();
        }
        
        let card = $($('.your-hand')[index]);

        var calloutDiv = $('<div>');
        calloutDiv.addClass('guess-callout');
        calloutDiv.addClass(color);
        calloutDiv.attr('id', 'yourGuessCallout');
        calloutDiv.html(buttonValue);

        card.prepend(calloutDiv);
        
        return calloutDiv;
    }
}

function updateCalloutValue(value) {
    $('.guess-callout').html(value);
}

function setDeckTopDiv(card) {
    let dealer = $('#dealer');
    if(card.getNumber() !== null) {
        dealer.html(card.getNumber());
    } else {
        dealer.html("");
    }

    dealer.css({
        "background-color": card.getColor(),
        "color": Helpers.invertColor(card.getColor()),
    });
}

async function createHandDivsAndAddEventListenersToEnemyHand(myHands, enemyHands, socket) {
    for(var i = 0; i < myHands.length; i++) {
        await addCardDiv(myHands[i], i, 'your' , 'closed', socket);
    }

    for(var i = 0; i < enemyHands.length; i++) {
        await addCardDiv(enemyHands[i], i, 'enemy' , 'open', socket);
    }
}

async function addEventListnersToEnemyHand(pos, socket) {
    for(let i = pos; i < $(".enemy-hand").length; i++) {
        $($(".enemy-hand")[i]).click(() => {
            if(myTurn) {
                var enemyCardDivs = $(".enemy-hand");
                var newCard = $(enemyCardDivs[i]);
                var oldCard = $(enemyCardDivs[selectedCard]);
                
                oldCard.removeClass("selected");
                selectedCard = i;
                newCard.addClass("selected");
                
                socket.emit("selectCard", { guessTarget: selectedCard });
            }
        });
    }
}

async function addCardDiv (card, pos, playerType, state, socket) {
    var parentDiv = $(`#${playerType}Hand`);
    var newDiv = createDiv(pos, playerType, enemyHand.length, state);
    newDiv.html(card.getNumber());

    let hand = $(`.${playerType}-hand`);

    if(pos === hand.length) {
        parentDiv.append(newDiv);
    } else {
        $(hand[pos]).before(newDiv);
    }

    if (playerType === 'enemy') {
        await addEventListnersToEnemyHand(pos, socket);
    }

    newDiv.css({
        "z-index": "30",
        "background-color": card.getColor(),
        "color": Helpers.invertColor(card.getColor())
    });

    Animations.drawCardAnimation(newDiv, card);
}


function createDiv(pos, playerType, n, state){
    var newDiv = $("<div>");
    newDiv.addClass(`${playerType}-hand`);
    newDiv.addClass("card");
    newDiv.addClass(state);
    return newDiv;
}