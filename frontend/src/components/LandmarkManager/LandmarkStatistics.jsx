import React from 'react';
import { FaChartBar, FaMapMarkerAlt, FaRoute, FaEye } from 'react-icons/fa';
import { Card, Badge } from '../common/UI';
import { Flex, Grid, Stack } from '../common/Layout';

const LandmarkStatistics = ({ landmarks, trips, selectedTrip }) => {
  // Calculate statistics
  const totalLandmarks = landmarks.length;
  const categoriesCount = landmarks.reduce((acc, landmark) => {
    const category = landmark.category || 'uncategorized';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});

  const landmarksWithVisits = landmarks.filter(l => l.trip_count > 0).length;
  const totalVisits = landmarks.reduce((sum, l) => sum + (l.trip_count || 0), 0);
  const averageRadius = landmarks.length > 0 
    ? Math.round(landmarks.reduce((sum, l) => sum + l.radius_m, 0) / landmarks.length)
    : 0;

  const categoryLabels = {
    'gas-station': 'Gas Stations',
    'restaurant': 'Restaurants',
    'hotel': 'Hotels',
    'attraction': 'Attractions',
    'rest-area': 'Rest Areas',
    'emergency': 'Emergency',
    'other': 'Other',
    'uncategorized': 'Uncategorized'
  };

  const statCards = [
    {
      title: 'Total Landmarks',
      value: totalLandmarks,
      icon: FaMapMarkerAlt,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Visited Landmarks',
      value: landmarksWithVisits,
      icon: FaEye,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'Total Visits',
      value: totalVisits,
      icon: FaRoute,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      title: 'Average Radius',
      value: `${averageRadius}m`,
      icon: FaChartBar,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Overview Statistics */}
      <Grid cols="1 md:2 lg:4" className="gap-4">
        {statCards.map((stat, index) => (
          <Card key={index} className="p-4">
            <Flex align="center" className="gap-3">
              <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`text-xl ${stat.color}`} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-600">
                  {stat.title}
                </div>
              </div>
            </Flex>
          </Card>
        ))}
      </Grid>

      {/* Category Breakdown */}
      {Object.keys(categoriesCount).length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Landmarks by Category
          </h3>
          <div className="space-y-3">
            {Object.entries(categoriesCount)
              .sort(([,a], [,b]) => b - a)
              .map(([category, count]) => (
                <Flex key={category} justify="between" align="center">
                  <span className="text-gray-700">
                    {categoryLabels[category] || category}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" size="sm">
                      {count}
                    </Badge>
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${(count / totalLandmarks) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                </Flex>
              ))}
          </div>
        </Card>
      )}

      {/* Trip-specific Statistics */}
      {selectedTrip && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Trip Statistics: {selectedTrip.name || `Trip ${selectedTrip.id}`}
          </h3>
          <div className="space-y-2 text-sm">
            <Flex justify="between">
              <span className="text-gray-600">Landmarks on this trip:</span>
              <span className="font-medium">{landmarks.length}</span>
            </Flex>
            {selectedTrip.start_time && (
              <Flex justify="between">
                <span className="text-gray-600">Trip date:</span>
                <span className="font-medium">
                  {new Date(selectedTrip.start_time).toLocaleDateString()}
                </span>
              </Flex>
            )}
            {selectedTrip.duration_minutes && (
              <Flex justify="between">
                <span className="text-gray-600">Duration:</span>
                <span className="font-medium">
                  {Math.round(selectedTrip.duration_minutes)} minutes
                </span>
              </Flex>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default LandmarkStatistics;
