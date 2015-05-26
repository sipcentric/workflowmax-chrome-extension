function scTestCredentials(scUser, scPass) {
  var headers = {
    Authorization: 'Basic ' + btoa(scUser + ':' + scPass)
  };

  var ajaxResponse = $.ajax({
    type: 'GET',
    url: 'https://pbx.sipcentric.com/api/v1/customers/me',
    headers: headers,
    async: false,
    success: function(data) {
      return data;
    },
    error: function(err) {
      return err;
    }
  });

  var status = ajaxResponse.status;
  var response = status === 200 ? ajaxResponse.responseJSON : false;
  return response;
}


function scGetEndpoints(url) {

  var headers = {
    Authorization: 'Basic ' + localStorage.getItem('scAuth')
  };

  var ajaxResponse = $.ajax({
    type: 'GET',
    url: url,
    headers: headers,
    data: {
      pageSize: 100,
      type: 'phone'
    },
    async: false,
    success: function(data) {
      return data;
    },
    error: function(err) {
      return err;
    }
  });

  var status = ajaxResponse.status;
  var response = status === 200 ? ajaxResponse.responseJSON : false;
  return response;
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

function wfmListSuppliers() {
  var wfmBaseUrl = 'https://api.workflowmax.com/supplier.api';
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
      var suppliers = $(xmlDoc).find('Suppliers');
      return suppliers;
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
    };

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


function wfmGetAllSuppliers(xmlSuppliers) {

  if ( localStorage.getItem('wfmSuppliers') ) {
    return JSON.parse( localStorage.getItem('wfmSuppliers') );
  }

  var suppliers = [];

  $(xmlSuppliers).find('Supplier').each(function() {

    var supplier = {
      id       : $(this).find('ID').html(),
      type     : 'supplier',
      name     : $(this).find('Name').html(),
      number   : $(this).find('Phone').html(),
      website  : $(this).find('Website').html(),
      contacts : []
    };

    $(this).find('Contacts').each(function() {
      var contact = {
        id     : $(this).find('ID').html(),
        name   : $(this).find('Name').html(),
        email  : $(this).find('Email').html(),
        number : $(this).find('Phone').html(),
        mobile : $(this).find('Mobile').html()
      };
      supplier.contacts.push(contact);
    });

    suppliers.push(supplier);
  });

  return suppliers;
}


function buildEndpointDropdown() {
  var listHtml = '';
  var endpoints = JSON.parse( localStorage.getItem('scEndpoints') );
  for (var i in endpoints) {
    var endpoint = endpoints[i];
    listHtml += '<li data-endpoint="'+endpoint.uri+'">'+endpoint.shortNumber+' - '+endpoint.name+'</li>';
  }
  $('#sc-endpoint-select').html(listHtml);
}


function updateStatusIndicators() {
  var statusGood = 'status good';
  var statusBad  = 'status bad';

  var scStatus  = localStorage.getItem('scStatus') ? statusGood : statusBad;
  var wfmStatus = localStorage.getItem('wfmStatus') ? statusGood : statusBad;

  $('#sc-status-indicator').removeClass().addClass(scStatus);
  $('#wfm-status-indicator').removeClass().addClass(wfmStatus);
}


function scSubmitLogin(scUser, scPass) {

  var customer = scTestCredentials(scUser, scPass);

  if (customer) {
    localStorage.setItem('scAuth', btoa(scUser + ':' + scPass) );
    var endpoints = scGetEndpoints(customer.links.endpoints).items;

    if (endpoints) {
      localStorage.setItem('scEndpoints', JSON.stringify(endpoints) );
      loadView();
      return true;
    } else {
      console.warn('Error fetching endpoints');
      return false;
    }

  } else {
    console.warn('Invalid Sipcentric credentials');
    return false;
  }
}

function wfmSubmitLogin(wfmApiKey, wfmAccKey) {
  localStorage.setItem('wfmApiKey', wfmApiKey);
  localStorage.setItem('wfmAccKey', wfmAccKey);
  var xmlClients = wfmListClients();
  var xmlSuppliers = wfmListSuppliers();

  if (xmlClients) {
    var clients = wfmGetAllClients(xmlClients);
    var suppliers = wfmGetAllSuppliers(xmlClients);
    localStorage.setItem('wfmClients', JSON.stringify(clients));
    localStorage.setItem('wfmSuppliers', JSON.stringify(suppliers));
    chrome.extension.sendRequest({msg: 'startStream'});
    loadView();
    return true;
  } else {
    localStorage.removeItem('wfmApiKey');
    localStorage.removeItem('wfmAccKey');
    return false;
  }
}


function loadView() {

  $('.view').hide();

  if ( !localStorage.getItem('scAuth') || !localStorage.getItem('scEndpoints') ) {
    $('#greeting-view').show();
    return;
  } else if ( !localStorage.getItem('scUser') ) {
    buildEndpointDropdown();
    $('#sc-endpoint-view').show();
    return;
  } else if ( !localStorage.getItem('wfmApiKey') || !localStorage.getItem('wfmAccKey') ) {
    $('#wfm-login-view').show();
    $('#wfm-api-key-input').val(localStorage.getItem('wfmApiKeyTemp'));
    $('#wfm-acc-key-input').val(localStorage.getItem('wfmAccKeyTemp'));
    return;
  } else {
    updateStatusIndicators();
    $('#main-view').show();
    return;
  }

}


chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
  if (request.msg == 'updateStatus') {
    updateStatusIndicators();
  }
});


$(document).on('click', '#wfm-login-submit', function() {
  var wfmApiKey = $('#wfm-api-key-input').val();
  var wfmAccKey = $('#wfm-acc-key-input').val();

  var valid = wfmSubmitLogin(wfmApiKey, wfmAccKey);

  if (!valid) {
    $('wfm-api-key-input').val('').focus();
    $('wfm-acc-key-input').val('');
    $('#wfm-login-alert').fadeIn(300).delay(3000).fadeOut(300);
  }

});


$('#wfm-login-form input').keyup(function(e) {
  var wfmApiKey = $('#wfm-api-key-input').val();
  var wfmAccKey = $('#wfm-acc-key-input').val();

  localStorage.setItem('wfmApiKeyTemp', wfmApiKey);
  localStorage.setItem('wfmAccKeyTemp', wfmAccKey);

  if (e.which == 13) {
    e.preventDefault();

    var valid = wfmSubmitLogin(wfmApiKey, wfmAccKey);

    if (!valid) {
      $('wfm-api-key-input').val('').focus();
      $('wfm-acc-key-input').val('');
      $('#wfm-login-alert').fadeIn(300).delay(3000).fadeOut(300);
    }
  }
});


$(document).on('click', '#sc-endpoint-select li', function() {
  var endpointUriSplit = $(this).attr('data-endpoint').split('/');
  var endpointUser = endpointUriSplit[endpointUriSplit.length-1];
  localStorage.setItem('scUser', endpointUser);
  loadView();
});


$(document).on('click', '#greeting-advance', function() {
  $('#greeting-view').hide();
  $('#sc-login-view').show();
  $('#sc-user-input').focus();
});


$(document).on('click', '#sc-login-submit', function() {
  var scUser = $('#sc-user-input').val();
  var scPass = $('#sc-pass-input').val();

  var valid = scSubmitLogin(scUser, scPass);

  if (!valid) {
    $('#sc-user-input').val('').focus();
    $('#sc-pass-input').val('');
    $('#sc-login-alert').fadeIn(300).delay(3000).fadeOut(300);
  }

});


$('#sc-login-form input').keypress(function(e) {
  if (e.which == 13) {
    e.preventDefault();
    var scUser = $('#sc-user-input').val();
    var scPass = $('#sc-pass-input').val();

    var valid = scSubmitLogin(scUser, scPass);

    if (!valid) {
      $('#sc-user-input').val('').focus();
      $('#sc-pass-input').val('');
      $('#sc-login-alert').fadeIn(300).delay(3000).fadeOut(300);
    }

  }
});


$(document).on('click', 'button#reconnect', function() {
  var wfmApiKey = localStorage.getItem('wfmApiKey');
  var wfmAccKey = localStorage.getItem('wfmAccKey');
  $('.status').removeClass().addClass('status default');
  $(this).text('Reconnecting...');
  setTimeout(function() {
    $('button#reconnect').text('Reconnect');
  }, 1500);

  var valid = wfmSubmitLogin(wfmApiKey, wfmAccKey);
  if (!valid) {
    $('#wfm-credentials-alert').fadeIn(300);
    localStorage.setItem('wfmApiKey', wfmApiKey);
    localStorage.setItem('wfmAccKey', wfmAccKey);
  }
});


$(document).on('click', 'button#logout', function() {
  $(this).removeClass('btn-default').addClass('btn-danger confirm');
  $(this).text('Sure?');
});


$(document).on('click', 'button#logout.confirm', function() {
  $(this).removeClass('btn-danger confirm').addClass('btn-default');
  $(this).text('Logout');
  localStorage.clear();
  loadView();
});



$(document).ready(function() {
  loadView();

});
