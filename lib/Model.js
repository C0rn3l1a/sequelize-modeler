const Sequelize = require('sequelize')
const moment = require('moment')
const log = require('console-emoji')
const coolors = require('node-coolors')
const Catalog = require('./services/catalog')
const camelize = require('./utils').camelize
const dequerylize = require('./utils').dequerylize

/** 
 * @author N4cho!
 * Model
 * --------
 * @description	_Class that extends functionality and versatility of Sequelize models_
 * @alias Model
 * @class Model
 * @extends {Sequelize.Model}
 * @typedef {Model} Model 
 * @typedef {typeof Model} Builder 
 * @typedef {{
 * 			integer: number
 * 			decimal: number, 
 * 			bigint: number, 
 * 			float: number, 
 * 			real: number, 
 * 			double: number,
 * 			string: string,
 * 			text: string,
 * 			citext: string,
 * 			date: import('moment').Moment,
 * 			dateonly: import('moment').Moment,
 * 			boolean: boolean,
 * 			enum: [any],
 * 			array: [any],
 * 			json: Object,
 * 			jsonb: Object,
 * 			blob: BlobPart,
 * 			uuid: string,
 * 			cidr: any,
 * 			inet: any,
 * 			macaddr: any,
 * 			range: [any],
 * 			geometry: any,
 * 			all: any,
 * 			}} Empty 
 * 
 * @typedef {{key:string
 *           as:string
 *           label:string
 *           dataType:string
 *           required:boolean
 *           defaultValue:any
 *           format:string
 *           autoIncrement:boolean
 * 			}} Field 
 * @typedef {import('express').Request} req
 * @typedef {import('express').Response} res
 * @typedef {import('express').NextFunction} next
 * @typedef {import('express').Router} Router
 * 
 * @callback errorCallback
 * @param {req} req
 * @param {res} res
 * @param {next} next
 * @param {Error} e
 *
 * @callback failedCallback
 * @param {req} req
 * @param {res} res
 * @param {next} next
 * @param {Model} instance
 * 
 * @callback Middleware
 * @param {req} req
 * @param {res} res
 * @param {next} next
 */

class Model extends Sequelize.Model {
	/**
	 * @author N4cho!
     *
     * @description	List of numric dataTypes contained in the generated fields
	 *
	 * @readonly
	 * @static
	 * @memberof Model
	 */
	static get numerics(){
		return ['integer','decimal','bigint','float','real','double']
	}

	/**
	 * @author N4cho!
     *
     * @description	List of date dataTypes contained in the generated fields supported by moment.js
	 *
	 * @readonly
	 * @static
	 * @memberof Model
	 */
	static get momentables(){
		return ['date','dateonly']
	}

	/**
	 * @author N4cho!
     *
     * @description	initialization of the Model itself
	 * @readonly
	 * @static
	 * @memberof Model
	 */
	static init(config) {
        super.init(config.fields, config.options)
		this.configuration = config
		this.connectionId = config.options.connectionId
		this.pk = config.options.primaryKey
		config.options.dateFormat ? this.setDefaultDateFormat(config.options.dateFormat) : this.setDefaultDateFormat(Catalog.getDefaultDateFormat(this.connectionId))
		Catalog.registerModel({model:this, connection:{id:config.options.connectionId, connection: config.options.sequelize}})
		for(let key in config.fields){
			let field = config.fields[key]
			Object.defineProperty(this.prototype, field.as, {
				get: function(){ return this[key]; },
				set: function(value){ this[key] = value; },
				enumerable: true,
				configurable: true
			})
		}
		return this
	}

	static getModelList(){
		return Catalog.getModelList()
	}

	static getDefaultDateFormat(){
		return this.defaultDateFormat
	}
	
	static setDefaultDateFormat(defaultDateFormat){
		return this.defaultDateFormat
	}

	static addAssociations(assocs){
		this.associationMap = {}
		for(let association of assocs){
			this.associationMap[association.foreignKey] = association
		}
	}

	static getApiName(){
		if(this.apiname){
			return this.apiname	
		}
		else{
			return camelize(this.name,'_')
		}
	}

	static setApiName(apiname){
		this.apiname = apiname 
	}

	static setFields(fields){
		this.aliasFields = fields
	}

	/**
	 * @author N4cho!
	 * @description Returns the list of fields of the model
	 * @static
	 * @returns {[Field]}
	 * @memberof Model
	 */
	static getFields(){
		if(this.aliasFields){
			return this.aliasFields
		}
		else{
			return Object.keys(this.configuration.fields).map(fieldName => {
				// let field = {visible:true, cardVisible:true, filterable:true}
				field.key = fieldName
				field.filterable = this.configuration.fields[fieldName].filterable || true
				field.visible = this.configuration.fields[fieldName].visible || true
				field.as = this.configuration.fields[fieldName].as || fieldName.toLocaleLowerCase()
				field.label = this.configuration.fields[fieldName].label || fieldName.toLocaleLowerCase()
				field.dataType = this.configuration.fields[fieldName].type.key.toLocaleLowerCase()
				field.required = !this.configuration.fields[fieldName].allowNull
				field.defaultValue = this.configuration.fields[fieldName].defaultValue
				field.format = this.configuration.fields[fieldName].format
				field.autoIncrement = this.configuration.fields[fieldName].autoIncrement ? this.configuration.fields[fieldName].autoIncrement : false
				return field
			})
		}
	}

	static setPk(pk){
		this.pk = pk
	}

	static getPk(){
		return this.pk
	}

	/**
	 * @author N4cho!
	 * @static
	 * @param {Object} source
	 * @returns {Promise<boolean>}
	 * @memberof Model
	 */
	static async validate(source) {
		await this.build(source).validate()
	}
	
	/**
	 * @author N4cho!
	 * @description Builds a model instance from json data in aliased format with optional configurations
	 * - supports transaction (config.transaction)
	 * - supports specific format for date fileds (config.dateFormat)
	 * - supports building non persistent instance (config.save)
	 * @static
	 * @param {Object} json
	 * @param {Object} config
	 * @param {boolean} config.save
	 * @param {import('sequelize').Transaction} config.transaction
	 * @param {string} config.dateFormat
	 * @param {Empty} config.empty
	 * @returns {Model}
	 * @memberof Model
	 */
	static async fromJson(json, {save = true, transaction, dateformat, empty} = { }) {
		let fields = this.getFields()
		let dateformat = dateFormat || this.getDefaultDateFormat()
		let buildJson = {}
		let addJson = {}
		try {
			for(let key in json){
				let field = fields.find( f => f.as === key)
				
				if(field && !field.autoIncrement){
					if(this.numerics.includes(field.dataType) && json[key] !== null && json[key] !== undefined){
						if(field.dataType === 'integer'){
							obj[field.as] = parseInt(obj[field.as], 10)
						}
						else{
							obj[field.as] = parseFloat(obj[field.as])
						}
					}
					if(this.momentables.includes(field.dataType) && json[key] !== null && json[key] !== undefined){
						json[key] = moment(obj[field.as]).format(field.format || dateformat)
					}
					
					if(field.required){
						if((json[key] === null || json[key] === undefined) && field.defaultValue !== undefined){
							buildJson[field.key] = field.defaultValue	
						}
						else if((json[key] === null || json[key] === undefined) && empty[field.dataType] !== undefined){
							buildJson[field.key] = empty[field.dataType]
						}
						else if((json[key] === null || json[key] === undefined) && empty.all !== undefined){
							buildJson[field.key] = empty.all
						}
						else{
							buildJson[field.key] = json[key]	
						}
					}
					else{
						if((json[key] === null || json[key] === undefined) && field.defaultValue !== undefined){
							addJson[field.key] = field.defaultValue	
						}
						else if((json[key] === null || json[key] === undefined) && empty[field.dataType] !== undefined){
							addJson[field.key] = empty[field.dataType]
						}
						else if((json[key] === null || json[key] === undefined) && empty.all !== undefined){
							addJson[field.key] = empty.all
						}
						else{
							addJson[field.key] = json[key]	
						}
					}
				}
			}
			
			let instance = this.build(buildJson)
			for(let key in addJson){
				instance[key] = addJson[key]
			}
			if(save){
				await instance.save({transaction})
			}
			return instance
		}
		catch (err) {
			throw err
		}
	}
	
	static belongsTo(target,options){
		let modelName = 'Target Model'
		if(typeof target === 'string'){
			modelName = target
			target = Catalog.getModels(this.connectionId)[target]
		}
		if(target){
			super.belongsTo(target,options)
		}else{
			log(coolors.bgRed(`:rage: ${modelName} does not ${coolors.bright('exist')}`))
		}
	}

	static hasOne(target,options){
		let modelName = 'Target Model'
		if(typeof target === 'string'){
			modelName = target
			target = Catalog.getModels(this.connectionId)[target]
		}
		if(target){
            super.hasOne(target,options)
        }else{
			log(coolors.bgRed(`:rage: ${modelName} does not ${coolors.bright('exist')}`))
		}
    }
	
	static hasMany(target,options){
		let modelName = 'Target Model'
		if(typeof target === 'string'){
			modelName = target
			target = Catalog.getModels(this.connectionId)[target]
		}
		if(target){
            super.hasMany(target,options)
        }else{
			log(coolors.bgRed(`:rage: ${modelName} does not ${coolors.bright('exist')}`))
		}
    }
	
	static belongsToMany(target,options){
		let modelName = 'Target Model'
		if(typeof target === 'string'){
			modelName = target
			target = Catalog.getModels(this.connectionId)[target]
		}
		if(target){
            super.belongsToMany(target,options)
        }else{
			log(coolors.bgRed(`:rage: ${modelName} does not ${coolors.bright('exist')}`))
		}
	}



	/**
	 * @author N4cho!
	 * @description Generates an API Rest router for the given model.
	 * Options :
	 * ---------
	 * - Accepts specific model or name of model (requires connection id or object) or function(must return a model)
	 * - Accepts an error callback that excecutes when the request fails
	 * - Accepts a fail callback that excecutes when an instance cannot be created (post only)
	 * - Accepts custom apiname for the url of the models (ex: href:'http:localhost:80/${apiname}')
	 * - Accepts extra middlwares to be places before or after the generated ones on each method and meta
	 * - Accepts a field list to be used by the model either for the creation or the format method
	 * - Can make the generated middlewares excecute the ```next``` function and append the instance or an error to ```req.body._carried_```
	 * - Can toggle which method must be generated
	 * @static
	 * @param {Object} config - configuration
	 * @param {Builder} config.model - Model to be used
	 * @param {import('./services/catalog').Connection|string} config.connection - Connection to be used when model is string
	 * @param {failedCallback} config.failed - callback to be excecuted when creation fails (req,res,next,instance)
	 * @param {errorCallback} config.error - callbback to be excecuted in case of an internal error (req,res,next,error)
	 * @param {Empty} config.empty - callbback to be excecuted in case of an internal error (req,res,next,error)
	 * @param {string} config.apiname - name used to build href of models
	 * @param {boolean} [config.next=false] - toggle the excecution of ```next()```
	 * @param {Object} config.middlewares - extra optional middlwares to be added
	 * @param {[{place:'before'|'after', handler:Middleware}]} config.middlewares.get - place indicates if middlware must be excecuted before or after the generated one
	 * @param {[{place:'before'|'after', handler:Middleware}]} config.middlewares.getOne - place indicates if middlware must be excecuted before or after the generated one
	 * @param {[{place:'before'|'after', handler:Middleware}]} config.middlewares.post - place indicates if middlware must be excecuted before or after the generated one
	 * @param {[{place:'before'|'after', handler:Middleware}]} config.middlewares.put - place indicates if middlware must be excecuted before or after the generated one
	 * @param {[{place:'before'|'after', handler:Middleware}]} config.middlewares.delet - place indicates if middlware must be excecuted before or after the generated one
	 * @param {[{place:'before'|'after', handler:Middleware}]} config.middlewares.meta - place indicates if middlware must be excecuted before or after the generated one
	 * @param {boolean} config.get - toggles the '[GET]' method
	 * @param {boolean} config.getOne - toggles the '[GET] /:id' endpoint
	 * @param {boolean} config.post - toggles the '[POST]' method
	 * @param {boolean} config.put - toggles the '[PUT]' method
	 * @param {boolean} config.delet - toggles the '[DELETE]' method
	 * @param {boolean} config.meta - toggles the '/meta' endpoint
	 * @param {[Field]} config.fields - list of fields to be used by the model
	 * @returns {Router}
	 * @memberof Model
	 */
	static generateApi({connection, model, failed, error, empty, apiname, next=false, middlewares = {getOne:[], get:[], post:[], put:[], delet:[], meta:[]}, getOne=true, get=true, post=true, put=true, delet=true, meta=true, fields}={}){
		/** @returns {Model} */
		let decypherModel = (req,res,next) => {
			if(model){
				if(typeof model === 'function'){
					return model(req,res,next)
				}
				else if(typeof model === 'object'){
					return model
				}
				else if(connection && typeof connection === 'object'){
					return connection.Models[model]
				}
				else if(connection){
					return Catalog.getConnection(connection).Models[model]
				}
			}
			else{
				return this
			}
		}
		const express = require('express')
		const router = express.Router()
		const _next = next
		
		if(meta){
			let before = middlewares.meta.filter(m => m.place === 'before' || m.place === undefined).map(m => typeof m === 'function' ? m : m.handler)
			let after = middlewares.meta.filter(m => m.place === 'after').map(m => m.handler)
			router.route('/meta').get(...before, async (req,res,next) => {
				let _model = decypherModel(req,res,next)
				fields = fields || _model.getFields()
				apiname = apiname || _model.getApiName()
				try {
					let tableName = _model.configuration.options.tableName
					let { visiblefields, limit=25, offset=0, order, where={}, expand=false } = dequerylize(req.query, fields)
					let count = await _model.count({where})
					let response = {
						visible: visiblefields.map(field => {field.key = '' + field.as; delete field.as ; return field}),
						entries: count,
						name: tableName,
						filters: fields.filter(field => field.filterable).map(field => field.key),
						required: fields.filter(field => field.required).map(field => field.key)
					}
					if(_next){
						req.body._carried_ = response
						next()
					}
					else{
						res.json(response)
					}
					
				}catch(e){
					if(_next){
						req.body._carried_ = e
						next()
					}
					else{
						if(error){
							error(req,res,next,e)
						}
						else{
							res.status(500).send('Internal Server Error').end()
						}
					}
					
				}
			},...after)
		}
		
		if(get){
			let before = middlewares.get.filter(m => m.place === 'before' || m.place === undefined).map(m => typeof m === 'function' ? m : m.handler)
			let after = middlewares.get.filter(m => m.place === 'after').map(m => m.handler)
			router.get('/',...before, async(req, res, next) => {
				let _model = decypherModel(req,res,next)
				fields = fields || _model.getFields()
				apiname = apiname || _model.getApiName()
				try {
					let response
					let { visiblefields, limit=25, offset=0, order, where={}, expand=false } = dequerylize(req.query, fields)
					const { docs:instances, pages, total } = await _model.paginate({where, order, page: offset+1, paginate: limit})
					if(instances.length > 0){
						response = instances.map(x => x.format({expand, visiblefields, apiname, empty}))
					}else{
						response = []
					}
					if(_next){
						req.body._carried_ = response
						next()
					}
					else{
						res.json(response)
					}
				}catch(e){
					if(_next){
						req.body._carried_ = e
						next()
					}
					else{
						if(error){
							error(req,res,next,e)
						}
						else{
							console.log(e)
							res.status(500).send('Internal Server Error').end()
						}
					}
					
				}
			},...after)
		}
		if(getOne){
			let before = middlewares.getOne.filter(m => m.place === 'before' || m.place === undefined).map(m => typeof m === 'function' ? m : m.handler)
			let after = middlewares.getOne.filter(m => m.place === 'after').map(m => m.handler)
			router.get('/:id', ...before, async(req, res, next) => {
				let _model = decypherModel(req,res,next)
				fields = fields || _model.getFields()
				apiname = apiname || _model.getApiName()
				try {
					let id = req.params.id
					let { visiblefields } = dequerylize(req.query, fields)
					let response = await _model.findOne({where:{[_model.getPk()] : id}})
					if(response){
						response = response.format({expand, visiblefields, apiname, empty})
					}
					if(_next){
						req.body._carried_ = response
						next()
					}
					else{
						res.json(response)
					}
				}catch(e){
					if(_next){
						req.body._carried_ = e
						next()
					}
					else{
						if(error){
							error(req,res,next,e)
						}
						else{
							res.status(500).send('Internal Server Error').end()
						}
					}
				}		
			}, ...after)
		}
		if(post){
			let before = middlewares.post.filter(m => m.place === 'before' || m.place === undefined).map(m => typeof m === 'function' ? m : m.handler)
			let after = middlewares.post.filter(m => m.place === 'after').map(m => m.handler)
			router.post('/',...before, async(req, res, next) => {
				let _model = decypherModel(req,res,next)
				fields = fields || _model.getFields()
				apiname = apiname || _model.getApiName()
				try {
					let response
					let instance = await _model.fromJson(data,{empty})
					if(instance){
						await instance.save()
						response = instance.format({expand, fields, apiname})
					}
					else{
						response = false
						if(failed){
							failed(req,res,next,instance)
						}
					}
					if(_next){
						req.body._carried_ = response
						next()
					}
					else{
						res.json(response)
					}
				}catch(e){
					if(_next){
						req.body._carried_ = e
						next()
					}
					else{
						if(error){
							error(req,res,next,e)
						}
						else{
							res.status(500).send('Internal Server Error').end()
						}
					}
				}
			}, ...after)
		}

		if(put){
			let before = middlewares.put.filter(m => m.place === 'before' || m.place === undefined).map(m => typeof m === 'function' ? m : m.handler)
			let after = middlewares.put.filter(m => m.place === 'after').map(m => m.handler)
			router.put('/:id', ...before, async (req, res, next) => {
				try{
					let _model = decypherModel(req,res,next)
					fields = fields || _model.getFields()
					apiname = apiname || _model.getApiName()
					const id = req.params.id
					const data = req.body
					let response
					let exists = await _model.exists(id)
					if(exists){
						let instance = await _model.findOne({where:{[_model.getPk()]: id}})
						for(let key in data){
							let field = _model.getFields().find(x => x.as === key)
							if(field && data[key]){
								if(_model.numerics.includes(field.dataType) && data[key] !== null){
									if(field.dataType === 'integer'){
										instance[field.key] = parseInt(data[key],10)
									}
									else{
										instance[field.key] = parseFloat(data[key])
									}
								}
								else if(_model.momentables.includes(field.dataType) && data[key] !== null){
									instance[field.key] = moment(data[key], moment.getDefaultDateFormat())
								}
								else{
									instance[field.key] = data[key]
								}
							}
						}
					}
					let result = await instance.save()
					if(result){
						response = result.format({expand, fields, apiname, empty})
					}
					if(_next){
						req.body._carried_ = response
						next()
					}
					else{
						res.json(response)
					}
				}catch(e){
					if(_next){
						req.body._carried_ = e
						next()
					}
					else{
						if(error){
							error(req,res,next,e)
						}
						else{
							res.status(500).send('Internal Server Error').end()
						}
					}
				}
			}, ...after)
		}

		if(delet){
			let before = middlewares.delet.filter(m => m.place === 'before' || m.place === undefined).map(m => typeof m === 'function' ? m : m.handler)
			let after = middlewares.delet.filter(m => m.place === 'after').map(m => m.handler)
			router.delete('/:id', ...before, async (req, res, next) => {
				let _model = decypherModel(req,res,next)
				fields = fields || _model.getFields()
				apiname = apiname || _model.getApiName()
				let id = req.params.id
				try{
					let exists = await _model.exists(id)
					let response = exists
					if ( exists ){
						let instance = await _model.findOne({where:{
							[_model.getPk()]: id}
						})
						await instance.destroy()
					}
					if(_next){
						req.body._carried_ = response
						next()
					}
					else{
						res.json(response)
					}
				}catch(e){
					if(_next){
						req.body._carried_ = e
						next()
					}
					else{
						if(error){
							error(req,res,next,e)
						}
						else{
							res.status(500).send('Internal Server Error').end()
						}
					}
				}
			}, ...after)
		}

		return router
	}

	/**
	 * @author N4cho!
	 * @description Returns the model instance in aliased json format.
	 * Options
	 * -------
	 * - TODO: Can format eagerloaded associations with its respective or a specified format
	 * - Accepts a list of fields to format de model to
	 * - Accepts different specifications or the generated link to the instace endpoint
	 * - Accepts specific format to display dates
	 * - Accepts a specific value for empty fields in the model
	 * @param {Object} config - Configuration
	 * @param {boolean} config.expand - TODO: toggle expansion of model
	 * @param {[Field]} config.fields - list of fields to format de model to
	 * @param {string} config.apiname - name to build the link of the model
	 * @param {string} config.dateFormat - custom format to display date fields
	 * @param {Empty} config.empty - custom value to fill empty fields
	 * @param {string|false} [config.link='href'] - name of the property wich will contain the model link, false omits this property
	 */
	format({expand, fields, apiname, dateFormat, empty, link = 'href'} = { }) {
		let numerics = Object.getPrototypeOf(this).constructor.numerics
		let momentables = Object.getPrototypeOf(this).constructor.momentables
		let dateformat = dateFormat || this._getDateFormat() || Object.getPrototypeOf(this).constructor.getDefaultDateFormat()
		fields = fields ? fields : Object.getPrototypeOf(this).constructor.getFields()
		if(!apiname){
			apiname = camelize(Object.getPrototypeOf(this).constructor.name.toLowerCase(),'_')
		}
		let pk = Object.getPrototypeOf(this).constructor.getPk()
		let obj = {}
		let url = `${process.env.HOST}${(process.env.STAGE > 1)?':'+process.env.PORT:''}/${apiname}/${this[pk]}`
		
		if(fields && fields === 'link'){
			return {[link]:url}
		}
		for (let field of fields) {
			if( this[field.key] !== null && this[field.key] !== undefined ){
				obj[field.as] = this[field.key]
				if(numerics.includes(field.dataType)){
					if(field.dataType === 'integer'){
						obj[field.as] = parseInt(obj[field.as], 10)
					}
					else{
						obj[field.as] = parseFloat(obj[field.as])
					}
				}
				else if(momentables.includes(field.dataType)){
					obj[field.as] = moment(obj[field.as]).format(field.format || dateformat)
				}
			}
			else{
				if(empty && empty[field.dataType] !== undefined){
					obj[field.as] = empty[field.dataType]
				}
				else if((empty && empty.all !== undefined)){
					obj[field.as] = empty.all
				}
				else{
					obj[field.as] = null
				}
			}
		}
		if(link){
			obj[link] = url
		}
		
		return obj
	}

	_getDateFormat(){
		return this._dateFormat
	}

	_setDateFormat(dateFormat){
		this._dateFormat = dateFormat
	}
}

module.exports = Model
