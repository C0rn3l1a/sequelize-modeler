const Sequelize = require('sequelize')
// const modeler = require('sequelize-modeler')
const Model = require('./index').Model
const Catalog = require('./index').Catalog

// const sequelize = new Sequelize(...config)

const sequelize = new Sequelize(...options)

Sequelize.INTEGER

const connectionId = Catalog.setConnection(sequelize)
let con = Catalog.getConnection('someId')
const {MyModel, MyOtherModel, ...etc} = Catalog.initialize([MyModel, MyOtherModel, ...etc], connectionId)

MyModel.findAll().then(instances => {
    //do stuff here
})

const router = require('express').Router()
router.use('/etc',MyModel.generateApi())

