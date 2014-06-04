exports.make = function(req, res) {
  res.render('streams/make', { title: 'new stream' });
};

exports.list = function(req, res, next) {

  var self = this,
      per_page = parseInt(req.param('per_page')) || 20,
      page = parseInt(req.param('page')) || 1;

  this.metadata.listByActivity(function(err, streams) {

    if(err) {
      err = new Error('loading the stream list failed.');
      err.status = 500;
      next(err);
      return;
    }

    streams = streams.map(function(stream) {
      stream.publicKey = self.keychain.publicKey(stream.id);
      return stream;
    });

    res.render('streams/list', {
      title: 'Public Streams',
      streams: streams,
      page: page,
      per_page: per_page
    });

  }, per_page * (page - 1), per_page);

};

exports.tag = function(req, res, next) {

  var self = this,
      page = parseInt(req.param('page')) || 1,
      per_page = parseInt(req.param('per_page')) || 20,
      tag = req.param('tag');

  this.metadata.listByTag(tag, function(err, streams) {

    if(err) {
      err = new Error('loading the stream list failed.');
      err.status = 500;
      next(err);
      return;
    }

    streams = streams.map(function(stream) {
      stream.publicKey = self.keychain.publicKey(stream.id);
      return stream;
    });

    res.render('streams/list', {
      title: 'Streams Tagged: ' + tag,
      streams: streams,
      page: page,
      per_page: per_page
    });

  }, per_page * (page - 1), per_page);

};

exports.view = function(req, res, next) {

  var id = this.keychain.getIdFromPublicKey(req.param('publicKey'));

  this.metadata.get(id, function(err, stream) {

    if(! stream || err) {
      err = new Error('stream not found');
      err.status = 404;
      return next(err);
    }

    res.render('streams/view', {
      title: 'stream ' + req.param('publicKey'),
      publicKey: req.param('publicKey'),
      stream: stream
    });

  });

};

exports.create = function(req, res, next) {

  var self = this,
      stream = {},
      err;

  if(req.param('check') !== '') {
    err = new Error('Bot check failed');
    err.status = 400;
    return next(err);
  }

  if(req.param('tags').trim()) {
    stream.tags = req.param('tags').split(',').map(function(tag) {
      return tag.trim();
    });
  }

  if(req.param('fields').trim()) {
    stream.fields = req.param('fields').split(',').map(function(field) {
      return field.trim();
    });
  }

  stream.title = req.param('title');
  stream.description = req.param('description');
  stream.hidden = (req.param('hidden') === '1' ? true : false);

  this.validator.create(stream, function(err) {

    if(err) {
      req.url = '/streams/make';
      req.method = 'GET';
      res.locals.messages = {
        'danger': ['creating stream failed - ' + err]
      };
      return next();
    }

    self.metadata.create(stream, function(err, stream) {

      if(err) {
        req.url = '/streams/make';
        req.method = 'GET';
        res.locals.messages = {
          'danger': ['saving stream failed']
        };
        return next();
      }

      res.render('streams/create', {
        title: 'stream ' + self.keychain.publicKey(stream.id),
        stream: stream,
        publicKey: self.keychain.publicKey(stream.id),
        privateKey: self.keychain.privateKey(stream.id),
        deleteKey: self.keychain.deleteKey(stream.id),
        notifiers: self.getNotifiers('create')
      });

    });

  });

};

exports.notify = function(req, res, next) {

  var self = this,
      type = req.param('type'),
      err;

  if(! type) {
    err = new Error('Missing notification type');
    err.status = 400;
    return next(err);
  }

  this.metadata.get(req.param('stream'), function(err, stream) {

    if(err) {
      err = new Error('unable to load stream');
      return next(err);
    }

    self.notify(type, req.body, {
      title: stream.title,
      publicKey: self.keychain.publicKey(stream.id),
      privateKey: self.keychain.privateKey(stream.id),
      deleteKey: self.keychain.deleteKey(stream.id)
    });

    res.locals.messages = {
      'success': ['Sent notification']
    };

    res.render('streams/create', {
      title: 'stream ' + self.keychain.publicKey(stream.id),
      stream: stream,
      publicKey: self.keychain.publicKey(stream.id),
      privateKey: self.keychain.privateKey(stream.id),
      deleteKey: self.keychain.deleteKey(stream.id),
      notifiers: self.getNotifiers('create')
    });

  });

};

exports.remove = function(req, res, next) {

  var pub = req.param('publicKey'),
      del = req.param('deleteKey'),
      self = this,
      id, err;

  // check for public key
  if(! pub) {
    err = new Error('Not Found');
    err.status = 404;
    next(err);
    return;
  }

  // check for private key
  if(! del) {
    err = new Error('forbidden: missing private key');
    err.status = 403;
    next(err);
    return;
  }

  // validate keys
  if(! this.keychain.validateDeleteKey(pub, del)) {
    err = new Error('forbidden: invalid delete key');
    err.status = 401;
    next(err);
    return;
  }

  id = this.keychain.getIdFromPublicKey(pub);

  this.metadata.remove(id, function(err, success) {

    if(err) {
      err = new Error('deleting the stream failed');
      err.status = 500;
      next(err);
      return;
    }

    self.emit('clear', id);


  });

};

