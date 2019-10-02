const uuid = require('uuid/v4')
const DataTypes = require('sequelize')
const sequelizePaginate = require('sequelize-paginate')

/**
 * @typedef { import('../Model').Builder } B
 * @typedef { import('../Model').Model } M
 * @typedef { {id:string, Connection: import('sequelize').Sequelize, Models: Object.<string, B>, parameters: {dateFormat: string}} } Connection
 */
class Catalog {

    /**
     * @author N4cho!
     * @description Returns a connection object based on the given id
     * @param {string} id - connection id
     * @returns {Connection}
     */
    static getConnection(id){
        if(!this.connections){
            this.connections = {}
        }
        return this.connections[id]
    }

    /**
     * @author N4cho!
     * @description 
     * Builds a connection object with the given id and sequelize instance, if no id is given a uuidv4 will be provided
     * 
     * @static
     * @param {string} id
     * @param {import('sequelize').Sequelize} Connection
     * @returns
     * @memberof Catalog
     */
    static setConnection(id, Connection){
        if(!this.connections){
            this.connections = {}
        }
        if(typeof id === 'object'){
            Connection = id
            id = uuid()
        }
        this.connections[id] = {
            id,
            connection:Connection, 
            Models:{},
            parameters:{}
        }
        return id
    }
    
    /**
     * @author N4cho!
     * @description Returns the list of models of a given connection
     * @static
     * @param {string} connectionid
     * @returns {Object.<string, B>}
     * @memberof Catalog
     */
    static getModels(connectionid){
        let connection = this.getConnection(connectionid)
        return connection.Models
    }
    /**
     * @author N4cho!
     * @description Registers a model into a connection object. 
     * - if the connection does not exist it tries to create it
     * - returns the id of the created or used connection
     * @static
     * @param {Object} config
     * @param {B} config.model
     * @param {Object} config.connection
     * @param {string} config.connection.id
     * @param {import('sequelize').Sequelize} config.connection.connection
     * @returns {string}
     * @memberof Catalog
     */
    static registerModel({model, connection:{id , connection}}){
        if(id){
            let Connection = this.getConnection(id)
            if(Connection){
                let modelName = model.name
                Connection.Models[modelName] = model
            }
            return id
        }
        else{
            let id = uuid()
            let modelName = model.name
            let Connection = {
                id,
                connection,
                Models:{[modelName]:model}
            }
            this.setConnection(id, Connection)
            return id
        }
    }

    
    /**
     * @author N4cho!
     * @description initializes the given list of models in the respective connection, this means that:
     * - proper sequelize initialization will be executed
     * - the model will be registered in the Catalog with its respective connection
     * - associations decared in ```model.associate``` will be registered
     * - pagination will be added to each model
     * @param {[B]} models 
     * @param {string} id - connection id
     * @returns {Object.<string, B>} - initialized models
     */
    static initialize(models, id){
        let C = this.getConnection(id)
        if(C){
            for(let Model of models){
                let model = Model.init(C.connection, DataTypes ,C.id)
                this.registerModel({model, connection:{id}})
            }
            Object.values(this.getModels(C.id)).map(model => {
                sequelizePaginate.paginate(model)
                if(typeof model.associate === 'function'){
                    model.associate(this.getModels(C.id))
                }
            })
            return this.getModels(C.id)
        }
    }

    /**
     * @author N4cho!
     * @description Returns the deafult date format for the conneciton
     * @param {stirng} id
     * @returns {string} - date format
     */
    static getDefaultDateFormat(id){
        let C = this.getConnection(id)
        return C.parameters.dateFormat
    }
    
    /**
     * @author N4cho!
     * @description Sets the deafult date format for the conneciton
     * @param {stirng} id
     * @param {stirng} dateFormat
     */
    static setDefaultDateFormat(id, dateFormat){
        let C = this.getConnection(id)
        C.parameters.dateFormat = dateFormat
    }
}

module.exports = Catalog