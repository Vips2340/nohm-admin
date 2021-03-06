_r(function (app) {
  if ( ! window.app.views.hasOwnProperty('model')) {
    app.views.model = {};
  }
  
  /**
   * Model list
   */
  app.views.model.index = app.base.paginatedListView.extend({
    
    collection: app.collections.Model,
    auto_render: true
    
  });
  
  /**
   * Model details (properties and meta values)
   */
  app.views.model.details = app.base.pageView.extend({
    
    auto_render: true,
    model: app.models.Model,
    required_params: 1,
    
    events: {
      'click .fake_link.load_instances': 'loadInstances'
    },
    
    afterRender: function () {
      app.base.pageView.prototype.afterRender.apply(this, Array.prototype.slice.apply(arguments));
      if (this.model.get('cardinality') < 1000) {
        this.loadInstances();
      }
    },
    
    load: function (callback) {
      var self = this;
      self.model.set({id: self.params[0]});
      self.model.fetch(function () {
        callback(null, self.model);
      });
    },
    
    loadInstances: function () {
      this.instance_list = new InstanceList(null, null, this.$el.find('.instance_list'), [this.model, this.params[1], this.params[2]]);
      this.$el.find('.fake_link.load_instances').hide();
    }
    
  });
  
  /**
   * Displays the version warning overlay and handles the overwriting process.
   * This must be bound to a view, because it needs to access `this´
   */
  var version_warning_overlay = function (e) {
    e.stopPropagation();
    app.overlay({
      view: 'version_warning_overlay',
      module: 'model'
    });
  }
  
  /**
   * Instance list
   */
  var InstanceList = app.base.paginatedListView.extend({
    
    auto_render: true,
    collection: app.collections.Instance,
    module: 'model',
    action: 'instance_list',
    
    events: {
      'click td:has(.version_warning)': 'showVersionWarning',
      'click tr[data-id]': 'openInstance',
      'click button[type="submit"]': 'searchInstances',
      'reset .form-search': 'resetSearch'
    },
    
    init: function () {
      this.model_definition = this.params[0];
      
      this.collection.model_name = this.model_definition.get('id');
      this.collection.search = {
        value: this.params[2] || null,
        property: this.params[1] || null
      };
      
      this.addLocals({
        model_definition: this.model_definition
      });
      _.bind(this);
    },
    
    // automatically fetch the additional data for each model on the current page.
    successRender: function () {
      var self = this;
      var num_models = this.locals.data.length;
      var loaded_models = 0;
      var args_array = Array.prototype.slice.call(arguments);
      var original_fn = app.base.paginatedListView.prototype.successRender;
      
      if (num_models > 0) {
        this.locals.data.each(function (model) {
          if (model.get('properties')) {
            if (--num_models <= 0) {
              original_fn.apply(self, args_array);
            }
          } else {
            model.model_name = self.collection.model_name;
            model.fetch(function () {
              if (++loaded_models === num_models) {
                original_fn.apply(self, args_array);
              }
            });
          }
        });
      } else {
        original_fn.apply(this, args_array);
      }
    },
    
    showVersionWarning: version_warning_overlay,
    
    openInstance: function (e) {
      var id = $(e.target).closest('tr').data('id');
      app.go('model/instance/'+this.model_definition.get('id')+'/'+id);
    },
    
    searchInstances: function (e) {
      e.preventDefault();
      this.collection.reset();
      var search = this.collection.search = {
        value: this.$el.find('.form-search input[type="text"]').val(),
        property: this.$el.find('.form-search select').val()
      };
      
      app.navigate('model/details/'+this.params[0].get('id')+'/'+search.property+'/'+search.value);
      this.render();
    },
    
    resetSearch: function () {
      app.go('model/details/'+this.params[0].get('id'));
    }
    
  });
  
  /**
   * Instance details
   */
  app.views.model.instance = app.base.pageView.extend({
    
    auto_render: true,
    model: app.models.Instance,
    required_params: 2,
    
    events: {
      'click .version_warning': 'showVersionWarning',
      'click .version_error': 'showVersionError',
      'click button.edit': 'editProperty',
      'click button.unlink': 'unlink',
      'click button.remove': 'removeInstance',
      'click button.link': 'link',
      'click button.fix_ndex': 'fixIndex'
    },
    
    load: function (callback) {
      var self = this;
      this.model_name = self.params[0];
      this.instance_id = self.params[1];
      
      async.parallel({
        instance: function (done) {
          self.model.set({id: self.instance_id});
          self.model.model_name = self.model_name;
          self.model.fetch(function (result) {done(null, result);});
        },
        
        model_definition: function (done) {
          var model_definition = new app.models.Model();
          model_definition.set({id: self.model_name});
          model_definition.fetch(function (result) {done(null, result);});
        },
        
        relations: function (done) {
          var relations = new app.models.Relation();
          relations.model_name = self.model_name;
          relations.instance_id = self.instance_id;
          relations.fetch(function (result){done(null, result);});
        }
      }, function (err, results) {
        self.addLocals(results);
        callback(err, results.instance);
      });
    },
    
    showVersionWarning: function () {
      app.overlay({
        view: 'version_warning_overlay',
        module: 'model'
      });
    },
    
    showVersionError: function (e) {
      var prop_name = $(e.target).closest('tr').find('td:first').text();
      app.overlay({
        view: 'version_error_overlay',
        module: 'model',
        locals: {
          property_name: prop_name
        }
      });
    },
    
    editProperty: function (e) {
      var property = $(e.target).closest('tr').children('td').first().text();
      var $el = $('#modal').append('<div></div>');
      var view = new EditPropertyView(null, null, $el, [property, this.model]);
      view.model.once('saved', this.render);
    },
    
    unlink: function (e) {
      
    },
    
    removeInstance: function (e) {
      var self = this;
      app.overlay({
        view: 'remove_overlay',
        module: 'model',
        confirm: function () {
          self.model.remove(function () {
            app.go('model/details/'+self.model_name);
          });
        }
      });
    },
    
    link: function (e) {
      
    },
    
    fixIndex: function (e) {
      
    }
    
  });
  
  var overlay_form = app.base.formView.extend({
    successRender: function () {
      app.overlay({
        module: this.module, 
        template: this.action,
        locals: {
          model: this.model
        },
        onRender: this.onRender,
        cancel: this.close
      });
    },
    
    onRender: function ($modal) {
      this.$el = $modal;
      this.el = this.$el[0];
      
      this.delegateEvents();
      
      this.handler = new app.formHandler(this);
      this.handler.link();
      
      if (_.isFunction(this.close)) {
        this.model.bind('saved', this.close);
      }
      
      if (_.isFunction(this.error)) {
        this.model.bind('error', this.error);
      }
    },
    
    onConfirm: function () {
      this.$el.find('form').submit();
    },
    
    close: function () {
      app.closeOverlay();
      this.model.unbind();
      this.$el.remove();
    }
  });
  
  var EditPropertyView = overlay_form.extend({
    
    auto_render: true,
    module: 'model',
    action: 'edit_property',
    model: app.models.EditProperty,
    
    events: {
      'click button.confirm': 'onConfirm'
    },
    
    init: function () {
      var property = this.params[0];
      var model = this.params[1];
      this.model.set({
        property: property,
        value: model.get('properties')[property],
        id: model.id,
        model_name: model.model_name,
        mode: 'raw'
      });
    }
    
  });
  
});