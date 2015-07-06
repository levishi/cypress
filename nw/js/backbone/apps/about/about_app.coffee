@App.module "AboutApp", (AboutApp, App, Backbone, Marionette, $, _) ->
  class Router extends App.Routers.Application
    module: AboutApp

    actions:
      show: ->

  router = new Router

  App.vent.on "start:about:app", (region, win) ->
    router.to "show", region: region, window: win