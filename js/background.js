// Global Variables
var scEndpoint;
var wfmClients;

var scStatus;
var wfmStatus;

var stream;
var socket;

var timer;


function resetTimer() {
  var timeout = 80000;
  clearTimeout(timer);

  console.timeEnd('Timer reset');
  console.time('Timer reset');

  timer = setTimeout(function() {
    console.warn('Timer timeout');
    startStream();
  }, timeout);
}


function updateGlobals() {
  scEndpoint = localStorage.getItem('scUser');
  wfmClients = JSON.parse( localStorage.getItem('wfmClients') );
}


function wfmRefreshClients() {
  var wfmPrevClients = localStorage.getItem('wfmClients');
  localStorage.removeItem('wfmClients');

  var xmlClients = wfmListClients();
  if (xmlClients) {
    var clients = wfmGetAllClients(xmlClients);
    localStorage.setItem('wfmClients', JSON.stringify(clients));
    localStorage.setItem('wfmStatus', true);
  } else {
    localStorage.setItem('wfmClients', wfmPrevClients);
    localStorage.setItem('wfmStatus', false);
  }

  chrome.extension.sendRequest({msg: 'updateStatus'});
  setTimeout(wfmRefreshClients, 300000);
}


function wfmListClients() {
  var wfmBaseUrl = 'https://api.workflowmax.com/client.api';
  var apiKey = localStorage.getItem('wfmApiKey');
  var accKey = localStorage.getItem('wfmAccKey');

  var url = wfmBaseUrl + '/list';
  var reqData = {
    apiKey: apiKey,
    accountKey: accKey
  };
  var ajaxResponse = $.ajax({
    type: 'GET',
    url: url,
    async: false,
    data: reqData,
    success: function(xmlDoc) {
      var clients = $(xmlDoc).find('Clients');
      return clients;
    },
    error: function(err) {
      return err;
    }
  });

  var status = ajaxResponse.status;
  var response = status === 200 ? ajaxResponse.responseXML : false;
  return response;
}


function wfmGetAllClients(xmlClients) {

  if ( localStorage.getItem('wfmClients') ) {
    return JSON.parse( localStorage.getItem('wfmClients') );
  }

  var clients = [];

  $(xmlClients).find('Client').each(function() {

    var client = {
      id       : $(this).find('ID').html(),
      name     : $(this).find('Name').html(),
      number   : $(this).find('Phone').html(),
      website  : $(this).find('Website').html(),
      contacts : []
    }

    $(this).find('Contacts').each(function() {
      var contact = {
        id     : $(this).find('ID').html(),
        name   : $(this).find('Name').html(),
        email  : $(this).find('Email').html(),
        number : $(this).find('Phone').html(),
        mobile : $(this).find('Mobile').html()
      };
      client.contacts.push(contact);
    });

    clients.push(client);
  });

  return clients;
}


function startStream() {

  try {
    socket.unsubscribe();
    console.info('Unsubscribed from stream');
  } catch (e) {
    // console.error(e);
  }

  socket = $.atmosphere;

  resetTimer();
  updateGlobals();
  wfmRefreshClients();

  var authHeaders = {
    Authorization: 'Basic ' + localStorage.getItem('scAuth')
  };

  stream = {
    url: 'https://pbx.sipcentric.com/api/v1/stream',
    contentType: 'application/json',
    logLevel: 'debug',
    headers: authHeaders,
    dropHeaders: false,
    attachHeadersAsQueryString: false,
    maxReconnectOnClose: 0,
    enableXDR: true,
    transport: 'streaming'
  };


  stream.onOpen = function(response) {
    console.info('Stream open');
  } //stream.onOpen


  stream.onError = function(response) {
    console.error('Stream error');
    localStorage.setItem('scStatus', false);
    chrome.extension.sendRequest({msg: 'updateStatus'});
    setTimeout(startStream, 30000);
  } //stream.onError


  stream.onMessage = function(response) {
    var json = response.responseBody;
    try {
      var message = JSON.parse(json);
    } catch (e) {
      return;
    }

    if (message.event == 'heartbeat') {
      console.info('heartbeat');
      resetTimer();
      return;
    } else if (message.event != 'incomingcall') {
      return;
    };

    var splitEndpoint = message.values.endpoint.split('/');
    var msgEndpoint = splitEndpoint[splitEndpoint.length-1];

    if (message.event == 'incomingcall' && msgEndpoint == scEndpoint) {
      var match = searchClients(message.values.callerIdNumber);
      if (match) {
        var notificationData = {
          number : message.values.callerIdNumber,
          name   : match.name,
          id     : match.id
        }
        createNotification(notificationData);
      } else {
        var notificationData = {
          number : message.values.callerIdNumber
        }
        createNotification(notificationData);
      }
    }

  } //stream.onMessage
  var subSocket = socket.subscribe(stream);

  localStorage.setItem('scStatus', true);
  chrome.extension.sendRequest({msg: 'updateStatus'});

}


function searchClients(query) {
  for (var i in wfmClients) {
    var client = wfmClients[i];
    var number = client.number.replace(/[^0-9]+/g, '');
    
    if (query == number) {
      return client;
    }
    for (var c in client.contacts) {
      var contact = client.contacts[c];
      var cNumber = contact.number.replace(/[^0-9]+/g, '');
      var cMobile = contact.mobile.replace(/[^0-9]+/g, '');
      
      if (cNumber == query || cMobile == query) {
        return client;
      }
    }
  }
  return false;
}


function createNotification(context) {
  var options = {
    type: 'basic',
    iconUrl: 'assets/wfm.png'
  }

  if (context.number == 'anonymous') {
    options.title = 'Call from anonymous';
    options.message = '';
    options.contextMessage = 'Cannot be opened in WorkflowMax';
    options.isClickable = false;
  } else if (context.id) {
    options.title = 'Call from ' + context.number;
    options.message = '';
    options.contextMessage = context.name;
    options.isClickable = true;
    options.buttons = [{title: 'Open in WorkflowMax'}];
  } else {
    options.title = 'Call from ' + context.number;
    options.message = '';
    options.contextMessage = 'No matches found in WorkflowMax';
    options.isClickable = false;
  }

  chrome.notifications.create(notificationId='', options=options, function(id) {
    if (options.isClickable === true) {
      localStorage.setItem(id, JSON.stringify(context));
      removeNotification(id);
    };
  });
}


function removeNotification(id) {
  setTimeout(function() {
    console.info('Notification removed from local storage: ' + id);
    localStorage.removeItem(id);
  }, 60000);
}


chrome.notifications.onClicked.addListener(function(id) {
  if ( localStorage.getItem(id) ) {
    var json = localStorage.getItem(id);
    var client = JSON.parse(json);
    var href = 'https://my.workflowmax.com/client/clientview.aspx?id=' + client.id;
    localStorage.removeItem(id);
    chrome.tabs.create({'url': href});
  }
});


chrome.notifications.onButtonClicked.addListener(function(id) {
  if ( localStorage.getItem(id) ) {
    var json = localStorage.getItem(id);
    var client = JSON.parse(json);
    var href = 'https://my.workflowmax.com/client/clientview.aspx?id=' + client.id;
    localStorage.removeItem(id);
    chrome.tabs.create({'url': href});
  }
});


chrome.notifications.onClosed.addListener(function(id) {
  localStorage.removeItem(id);
  console.info('Notification closed: ' + id);
});


chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
  if (request.msg == 'startStream') {
    console.info('Initiating stream');

    startStream();
  }
});


$(document).ready(function() {
  localStorage.getItem('scAuth') ? startStream() : false;
});
