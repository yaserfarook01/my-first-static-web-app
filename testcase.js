// Import the required modules from AWS SDK v3
const { EC2Client, DescribeInstancesCommand, DescribeSecurityGroupsCommand } = require('@aws-sdk/client-ec2');
const http = require('http');

// Set the region
const REGION_NAME = 'ap-south-1';

// Create EC2 service object
const ec2 = new EC2Client({ region: REGION_NAME , credentials,});

const instanceName = 'dev-test';

const result = [
    { name: "Auto-Assign public IP is enabled", weightage: 0, status: false, error: '' },
    { name: "Exposed 80 port in security group", weightage: 0, status: false, error: '' },
    { name: "WebService is running", weightage: 0, status: false, error: '' },
    { name: "homepage.html Webpage is available", weightage: 0, status: false, error: '' },
];

async function checkEC2() {
    try {
        // Describe Instances
        const data = await ec2.send(new DescribeInstancesCommand({
            Filters: [
                { Name: "tag:Name", Values: [instanceName] },
                { Name: "instance-state-name", Values: ["running"] },
            ],
        }));

        if (data.Reservations && data.Reservations.length > 0) {
            const instance = data.Reservations[0].Instances[0];

            // Check Auto-Assign public IP
            if (instance.PublicIpAddress) {
                result[0].status = true;
            }

            // Check Exposed 80 port in security group
            if (instance.SecurityGroups && instance.SecurityGroups.length > 0) {
                const groupId = instance.SecurityGroups[0].GroupId;

                // Describe Security Groups
                const rules = await ec2.send(new DescribeSecurityGroupsCommand({
                    GroupIds: [groupId],
                }));

                const instanceRules = rules.SecurityGroups[0];
                if (instanceRules && instanceRules.IpPermissions) {
                    if (instanceRules.IpPermissions.find(r => r.FromPort === 80)) {
                        result[1].status = true;

                        // Check WebService is running
                        const options = {
                            host: instance.PublicIpAddress,
                            port: 80,
                            timeout: 5000, // Set a timeout for the request
                        };

                        try {
                            // Check if the web service is running
                            const isWebServiceRunning = await new Promise((resolve, reject) => {
                                const request = http.get(options, (response) => {
                                    resolve(response.statusCode === 200);
                                });

                                request.on('error', (err) => {
                                    reject(err);
                                });
                            });

                            if (isWebServiceRunning) {
                                result[2].status = true;

                                // Check if homepage.html Webpage is available
                                const isIndexPageAvailable = await new Promise((resolve, reject) => {
                                    const indexRequest = http.get(`http://${instance.PublicIpAddress}/homepage.html`, (indexResponse) => {
                                        if (indexResponse.statusCode === 200) {
                                            resolve(true);
                                        } else {
                                            resolve(false);
                                            result[3].error = `Error accessing homepage.html webpage. Status code: ${indexResponse.statusCode}`;
                                        }
                                    });

                                    indexRequest.on('error', (err) => {
                                        resolve(false);
                                        result[3].error = `Error accessing homepage.html webpage: ${err.message}`;
                                    });
                                });

                                result[3].status = isIndexPageAvailable;
                            } else {
                                result[2].error = `WebService is not running`;
                            }
                        } catch (error) {
                            result[2].error = `Error accessing WebService: ${error.message}`;
                        }
                    } else {
                        result[1].error = `80 port is not exposed in security group`;
                    }
                }
            }
        } else {
            if (!result[0].status) result[0].error = 'Public IP is not assigned';
            if (!result[1].status) result[1].error = 'Port 80 not exposed';
            if (!result[2].status) result[2].error = 'Web service not running';
            if (!result[3].status) result[3].error = 'Webpage not available';
        }
        if (!result[0].status) result[0].error = 'Public IP is not assigned';
        if (!result[1].status) result[1].error = 'Port 80 not exposed';
        if (!result[2].status) result[2].error = 'Web service not running';
        if (!result[3].status) result[3].error = 'Webpage not available';
        // if (!result[0].status) result[0].error = 'CloudTrail created in the name "TestTrail" does not exist';
        result[0].weightage = result[0].status ? 0.25 : 0;
        result[1].weightage = result[1].status ? 0.25 : 0;
        result[2].weightage = result[2].status ? 0.25 : 0;
        result[3].weightage = result[3].status ? 0.25 : 0;
    } catch (error) {
        // console.error('Error occurred during EC2 check:', error);
    }
    return result;
}

(async () => {
    const result = await checkEC2();
    console.log(result);
    return result;
})();
