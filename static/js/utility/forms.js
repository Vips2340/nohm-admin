_r(function (app) {

  var formHandler = app.formHandler = function (view, model) {
    this.view = view;
    this.model = model || view.model;
    this.csrf = false;
    if (typeof(this.model) === 'undefined') {
      throw new Error('formHandler requires a model or the view to have a model');
    }
    this.autoLabels();
  };
  
  formHandler.prototype.autoLabels = function () {
    var $label = this.view.$el.find('[data-label]');
    var i18n = this.view.i18n;
    $label.each(function () {
      var $this = $(this);
      var str = 'forms.labels.'+$this.data('label');
      $this.html(jQuery.t(str, i18n[1], i18n[0]));
      $this.data('label', null);
    });
  };
  
  formHandler.prototype.getInputByName = function (name) {
    if ( ! name) {
      return $();
    }
    var $form = this.view.$el;
    var $el = $('input[data-link="'+name+'"]', $form);
    
    if ($el.length === 0) {
      $el = $('input[name="'+name+'"]', $form);
    }
    return $el;
  };
  
  formHandler.prototype.setError = function (name, error) {
    var $el = this.getInputByName(name);
    var $errSpan = $el.siblings('span.error');
    
    if ($el.length === 0) {
      $errSpan = $('.general_error', this.view.$el);
    }
    
    $errSpan.html($.t('forms.errors.'+error, this.view.i18n[1], this.view.i18n[0])).show('slow');
  };
  
  formHandler.prototype.clearError = function (name) {
    var $el = this.getInputByName(name);
    $el.siblings('span.error').html('').hide('fast');
  };
  
  formHandler.prototype.setLoading = function (name) {
    var $el = this.getInputByName(name);
    $el.siblings('.loading').show();
  };
  
  formHandler.prototype.clearLoading = function (name) {
    var $el = this.getInputByName(name);
    $el.siblings('.loading').hide();
  };
  
  formHandler.prototype.blurHandler = function (context) {
    var $this = $(context);
    var attrs = {};
    var name = $this.data('link');
    if (name === 'data-link') {
      name = $this.attr('name');
    }
    attrs[name] = $this.val();
    
    if (this.model.required.indexOf(name) === -1 && $this.attr('required')) {
      this.model.required.push(name);
    }
    this.model.set(attrs, {validate: true});
  };
  
  formHandler.prototype.getCsrf = function (callback) {
    var self = this;
    $.getJSON('/REST/Util/csrf', function (response) {
      var token = $.cookie(response.data);
      $.cookie(response.csrf_key, null);
      self.csrf = token;
      if (callback) {
        callback();
      }
    });
  };
  
  formHandler.prototype.link = function () {
    var $form = this.view.$el;
    var self = this;
    
    this.getCsrf();
    
    var $linkedInputs = $form.delegate('input[data-link]', 'blur', function () {
      self.blurHandler(this);
    });
    
    $linkedInputs.each(function () {
      if ($(this).attr('required')) {
        this.model.required.push(name);
      }
    });
    
    this.model.bind("valid", function (model, attributes) {
      _.each(attributes, function (val, key) {
        self.clearError(key, val);
      });
    });
    
    this.model.bind("error", function(model, error) {
      _.each(error, function (val, key) {
        self.setError(key, val);
      });
    });
    
    $form.bind('submit', function (e) {
      e.preventDefault();
      var $inputs = $form.find('input');
      $inputs.prop('disabled', true);
      // TODO: do client side validation first!
      self.model.set({'csrf-token': self.csrf});
      self.model.save(undefined, {        
        error: function (model, response) {
          var data =JSON.parse(response.responseText).data;
          if (data.error.msg === 'crsf failure') {
            self.setError(null, 'csrf');
          }
          $inputs.prop('disabled', false);
          var fields = data.fields;
          _.each(fields, function (val, key) {
            if (_.isArray(val) && val.length > 0) {
              var err = {};
              err[key] = val[0];
              self.model.trigger('error', model, err);
            }
          });
          self.getCsrf();
        },
        
        success: function (model) {
          $inputs.prop('disabled', false);
          self.model.trigger('saved', model);
          console.log('saved');
        }
        
      });
    });
    
    return this;
  };
  
});