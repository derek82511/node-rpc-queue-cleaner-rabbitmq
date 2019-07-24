const https = require('https');
const axios = require('axios');

if (typeof (process.env.MASTER_API_PROTO) === 'undefined'
    || typeof (process.env.MASTER_API_HOST) === 'undefined'
    || typeof (process.env.MASTER_API_PORT) === 'undefined'
    || typeof (process.env.MASTER_API_TOKEN) === 'undefined'
    || typeof (process.env.RABBIT_MQ_MGMT_PROTO) === 'undefined'
    || typeof (process.env.RABBIT_MQ_MGMT_HOST) === 'undefined'
    || typeof (process.env.RABBIT_MQ_MGMT_PORT) === 'undefined'
    || typeof (process.env.RABBIT_MQ_MGMT_USERNAME) === 'undefined'
    || typeof (process.env.RABBIT_MQ_MGMT_PASSWORD) === 'undefined'
    || typeof (process.env.APP_NAMESPACE) === 'undefined'
    || typeof (process.env.APP_NAME) === 'undefined') {
    console.error('Missing environment parameters')
    process.exit(1);
}

function getPods() {
    return axios.request({
        url: `${process.env.MASTER_API_PROTO}://${process.env.MASTER_API_HOST}:${process.env.MASTER_API_PORT}/api/v1/namespaces/${process.env.APP_NAMESPACE}/pods`,
        method: 'get',
        headers: {
            Authorization: `Bearer ${process.env.MASTER_API_TOKEN}`
        },
        responseType: 'json',
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
    })
}

function getQueues() {
    return axios.request({
        url: `${process.env.RABBIT_MQ_MGMT_PROTO}://${process.env.RABBIT_MQ_MGMT_HOST}:${process.env.RABBIT_MQ_MGMT_PORT}/api/queues`,
        method: 'get',
        auth: {
            username: process.env.RABBIT_MQ_MGMT_USERNAME,
            password: process.env.RABBIT_MQ_MGMT_PASSWORD
        },
        responseType: 'json',
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
    })
}

function deleteQueue(queueName) {
    return axios.request({
        url: `${process.env.RABBIT_MQ_MGMT_PROTO}://${process.env.RABBIT_MQ_MGMT_HOST}:${process.env.RABBIT_MQ_MGMT_PORT}/api/queues/%2F/${queueName}`,
        method: 'delete',
        auth: {
            username: process.env.RABBIT_MQ_MGMT_USERNAME,
            password: process.env.RABBIT_MQ_MGMT_PASSWORD
        },
        responseType: 'json',
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
    })
}

axios.all([getPods(), getQueues()])
    .then(axios.spread((getPodsRes, getQueuesRes) => {
        console.log('Get pods & queues info success.')

        let existPodNames = getPodsRes.data.items.filter(item => {
            return item.metadata.labels.app === process.env.APP_NAME
        }).map(item => {
            return item.metadata.name
        })

        console.log('existPods : ', existPodNames);

        let existQueueNames = getQueuesRes.data.filter(queue => {
            return queue.name.includes(process.env.APP_NAME)
        }).map(queue => {
            return queue.name
        })

        console.log('existQueues : ', existQueueNames)

        let deleteQueueNames = existQueueNames.filter(existQueueName => {
            return !existPodNames.some(existPodName => {
                return existQueueName.endsWith(`${existPodName}-default`)
            })
        })

        console.log('deleteQueues : ', deleteQueueNames)

        if (deleteQueueNames.length !== 0) {
            let deleteQueuePromises = deleteQueueNames.map(deleteQueueName => {
                return deleteQueue(deleteQueueName)
            })

            axios.all(deleteQueuePromises)
                .then((res) => {
                    console.log('Delete queues success. Process end.')
                    process.exit(0);
                })
                .catch(error => {
                    console.error('Error occurred while deleting queues : ', error.message)
                    process.exit(1);
                })
        } else {
            console.log('No need to delete queues. Process end.')
            process.exit(0);
        }
    }))
    .catch(error => {
        console.error('Error occurred while getting info : ', error.message)
        process.exit(1);
    })
