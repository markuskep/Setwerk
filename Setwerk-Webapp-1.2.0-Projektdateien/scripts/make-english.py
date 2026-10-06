import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
base=json.loads((root/'dist/exercises.js').read_text().split('=',1)[1].strip().rstrip(';'))
names='''Barbell Bench Press
Incline Barbell Bench Press
Decline Barbell Bench Press
Dumbbell Bench Press
Incline Dumbbell Bench Press
Decline Dumbbell Bench Press
Chest Press Machine
Incline Chest Press Machine
Smith Machine Bench Press
Smith Machine Incline Bench Press
Dumbbell Floor Press
Barbell Floor Press
Squeeze Press
Cable Chest Press
Pec Deck
Cable Fly
Dumbbell Fly
Incline Dumbbell Fly
High-to-Low Cable Crossover
Low-to-High Cable Crossover
Push-ups
Incline Push-ups
Decline Push-ups
Close-Grip Push-ups
Wide Push-ups
Knee Push-ups
Ring Push-ups
TRX Chest Press
Chest Dips
Assisted Dips
Barbell Row
Underhand Barbell Row
Pendlay Row
Single-Arm Dumbbell Row
Bent-Over Dumbbell Row
Chest-Supported Dumbbell Row
T-Bar Row
Chest-Supported T-Bar Row
Close-Grip Cable Row
Wide-Grip Cable Row
Single-Arm Cable Row
Seated Row Machine
High Row
Smith Machine Row
Resistance Band Row
TRX Row
Inverted Row
Ring Row
Meadows Row
Wide-Grip Lat Pulldown
Close-Grip Lat Pulldown
Underhand Lat Pulldown
Single-Arm Lat Pulldown
Neutral-Grip Lat Pulldown
Pull-ups
Chin-ups
Neutral-Grip Pull-ups
Assisted Pull-ups
Band-Assisted Pull-ups
Negative Pull-ups
Scapular Pull-ups
Dumbbell Pullover
Cable Pullover
Pullover Machine
45-Degree Back Extension
Back Extension Machine
Superman
Reverse Hyperextension
Dumbbell Shoulder Press
Seated Barbell Shoulder Press
Military Press
Arnold Press
Shoulder Press Machine
Smith Machine Shoulder Press
Landmine Press
Single-Arm Kettlebell Press
Pike Push-ups
Z-Press
Dumbbell Lateral Raise
Cable Lateral Raise
Lateral Raise Machine
Seated Lateral Raise
Dumbbell Front Raise
Cable Front Raise
Plate Front Raise
Incline Y-Raise
Reverse Pec Deck
Dumbbell Reverse Fly
Cable Reverse Fly
Face Pulls
Band Pull-Aparts
Cable External Rotation
Band External Rotation
Dumbbell Shrugs
Barbell Shrugs
Smith Machine Shrugs
Barbell Biceps Curl
EZ-Bar Curl
Dumbbell Biceps Curl
Alternating Dumbbell Curl
Hammer Curl
Cross-Body Hammer Curl
Incline Dumbbell Curl
Concentration Curl
EZ-Bar Preacher Curl
Dumbbell Preacher Curl
Biceps Curl Machine
Straight-Bar Cable Curl
Rope Cable Curl
Single-Arm Cable Curl
Bayesian Curl
Spider Curl
Reverse EZ-Bar Curl
Zottman Curl
Resistance Band Curl
TRX Biceps Curl
Rope Triceps Pushdown
Straight-Bar Triceps Pushdown
Single-Arm Triceps Pushdown
Reverse-Grip Triceps Pushdown
Overhead Rope Triceps Extension
Overhead Dumbbell Triceps Extension
EZ-Bar French Press
Dumbbell Skull Crushers
Dumbbell Triceps Kickback
Cable Triceps Kickback
Triceps Extension Machine
Band Triceps Extension
TRX Triceps Extension
Close-Grip Bench Press
Smith Machine Close-Grip Bench Press
Triceps Dips
Dumbbell Wrist Curl
Reverse Wrist Curl
Barbell Wrist Curl
Wrist Roller
Hand Gripper
Dead Hang
Plate Pinch Hold
Farmer Hold
Barbell Back Squat
Front Squat
Goblet Squat
Dumbbell Squat
Smith Machine Squat
Hack Squat
Pendulum Squat
Belt Squat
Bodyweight Squat
Sumo Squat
Box Squat
Heel-Elevated Squat
Landmine Squat
Assisted Pistol Squat
45-Degree Leg Press
Horizontal Leg Press
Single-Leg Press
Forward Lunge
Reverse Lunge
Walking Dumbbell Lunge
Barbell Lunge
Bulgarian Split Squat
Split Squat
Lateral Lunge
Step-ups
Smith Machine Reverse Lunge
Cossack Squat
Leg Extension
Single-Leg Extension
Reverse Nordic Curl
Barbell Romanian Deadlift
Dumbbell Romanian Deadlift
Single-Leg Romanian Deadlift
Good Morning
Deadlift
Sumo Deadlift
Trap-Bar Deadlift
Kettlebell Deadlift
Cable Pull-Through
Lying Leg Curl
Seated Leg Curl
Standing Leg Curl
Single-Leg Curl
Nordic Curl
Stability Ball Leg Curl
Sliding Leg Curl
Barbell Hip Thrust
Hip Thrust Machine
Smith Machine Hip Thrust
Glute Bridge
Single-Leg Glute Bridge
Single-Leg Hip Thrust
Frog Pumps
Cable Glute Kickback
Glute Kickback Machine
Donkey Kicks
Fire Hydrants
Hip Abduction Machine
Cable Hip Abduction
Side-Lying Leg Raise
Lateral Band Walk
Clamshells
Hip Adduction Machine
Cable Hip Adduction
Standing Calf Raise
Seated Calf Raise
Leg Press Calf Raise
Single-Leg Calf Raise
Dumbbell Calf Raise
Smith Machine Calf Raise
Tibialis Raise
Crunches
Cable Crunch
Ab Crunch Machine
Reverse Crunch
Bicycle Crunch
Sit-ups
Decline Sit-ups
Russian Twist
Lying Leg Raise
Hanging Leg Raise
Hanging Knee Raise
Captain's Chair Knee Raise
Dead Bug
Bird Dog
Ab Wheel Rollout
Cable Woodchop
Pallof Press
Heel Touches
V-Ups
Flutter Kicks
Forearm Plank
Side Plank
Hollow Hold
Bear Plank
Copenhagen Plank
Wall Sit
Burpees
Mountain Climbers
Kettlebell Swing
Dumbbell Thruster
Wall Balls
Box Jumps
Jump Squats
Medicine Ball Slam
Kettlebell Clean
Turkish Get-up
Farmer Walk
Suitcase Carry
Sled Push
Sled Pull
Treadmill Running
Outdoor Running
Walking
Incline Treadmill Walking
Stationary Bike
Indoor Cycling
Outdoor Cycling
Rowing Ergometer
Elliptical Trainer
Air Bike
SkiErg
Swimming
Stairmaster
Jump Rope
Battle Ropes
Jumping Jacks
High Knees
Shadow Boxing'''.splitlines()
assert len(names)==len(base),(len(names),len(base))
recipes={
'press':['Set up in a stable position with your wrists aligned above your forearms.','Lower the weight under control through a comfortable range of motion.','Press evenly forward or upward while keeping your core braced.'],
'fly':['Keep your torso stable and your elbows slightly bent.','Bring your arms together in an arc in front of your body.','Return slowly without allowing your shoulders to roll forward.'],
'pushup':['Plant your hands firmly and brace your abs and glutes.','Lower your body as one unit, with elbows angled slightly back.','Push back up without letting your hips sag.'],
'dip':['Grip the bars and keep your shoulders stable.','Bend your elbows and lower only as far as you can control.','Press up smoothly without swinging.'],
'row':['Brace your torso and maintain a stable spine in the starting position.','Drive your elbows back and pull the weight toward your torso.','Extend your arms under control without swinging your back.'],
'pulldown':['Use the specified grip and keep your torso steady.','Pull your elbows down; for pull-ups, move your body toward the bar.','Return slowly. Keep your arms straight for scapular pull-ups.'],
'pullover':['Keep your core and shoulders stable with your elbows slightly bent.','Move your arms from overhead toward your body.','Return under control without overextending your lower back.'],
'backextension':['Adjust the support pad or lie face down for the floor variation.','Raise your torso or legs under control until aligned with your body.','Lower slowly without arching beyond a neutral position.'],
'overhead':['Brace your core and glutes and position your hands for the press.','Press overhead under control; for pike push-ups, move your body instead.','Return without momentum while keeping your torso stable.'],
'raise':['Keep your torso still and your elbows slightly bent.','Raise your arms sideways or forward according to the variation.','Lower slowly without swinging from your back.'],
'reversefly':['Use a light resistance and brace your torso.','Move your arms outward, or toward your face for face pulls. Keep your elbows close to your body for external rotations.','Return slowly without shrugging your shoulders.'],
'shrug':['Stand tall with the weight at your sides or in front of your body.','Raise your shoulders straight up without rolling them.','Lower them under control.'],
'curl':['Keep your upper arms steady and your wrists straight.','Bend your elbows using the grip specified for the variation.','Lower slowly without using momentum from your torso.'],
'triceps':['Keep your upper arms still in the position required for the variation.','Straighten your elbows against the resistance.','Bend them again without moving your shoulders.'],
'wrist':['Support your forearms and hold the resistance securely.','Move your wrists or fingers as appropriate for the equipment.','Return slowly through a small, controlled range of motion.'],
'hold':['Set up in a stable starting position for the exercise.','Hold the position with steady breathing and muscle tension.','End the set when you can no longer maintain control of the position.'],
'squat':['Plant your feet firmly and brace your core.','Bend your hips and knees, keeping your knees in line with your toes.','Push through your whole foot to stand, keeping your back stable.'],
'legpress':['Adjust the seat and backrest and place your feet firmly on the platform.','Bend your knees slowly while keeping your pelvis on the pad.','Push the platform away without snapping your knees into lockout.'],
'lunge':['Set a stable stance, step position or platform.','Lower under control, keeping the working knee aligned with the foot.','Push through the working leg to return. Log repetitions per side.'],
'legextension':['Adjust the pad and machine pivot to align with your knees.','Straighten your knees under control; keep your hips extended for reverse Nordic curls.','Return slowly to the starting position.'],
'hinge':['Stand firmly, brace your core and keep the weight close to your body.','Push your hips back and bend your knees as required by the variation.','Extend your hips without overextending your back at the top.'],
'legcurl':['Adjust the pad or secure your feet for the selected variation.','Bend your knees against the resistance; for Nordic curls, control the lowering phase.','Return slowly and keep your hips stable.'],
'bridge':['Position your feet and upper-back support securely.','Drive through your feet to raise your hips and contract your glutes.','Lower under control without overextending your lower back.'],
'hip':['Keep your pelvis and torso stable.','Move the working leg outward, inward or backward according to the variation.','Return slowly without rotating your pelvis.'],
'calf':['Place your feet firmly and use a support if needed.','Raise your heels; for tibialis raises, lift your toes instead.','Lower under control without bouncing.'],
'crunch':['Set up in a stable position and brace your abs.','Move your torso or legs under control; keep your torso steady for dead bugs and bird dogs.','Return without swinging. Resist rotation during Pallof presses.'],
'conditioning':['Choose a weight or height that you can control confidently.','Perform each repetition deliberately and maintain control as speed increases.','Stop the set if technique deteriorates. Learn complex movements before adding speed or load.'],
'carry':['Grip the weight securely or take a stable position at the sled.','Move with controlled steps and a steady torso.','Record the distance covered and the set duration.'],
'cardio':['Adjust the equipment to fit you or choose a suitable route.','Start gently and build up to your planned pace.','Record duration and, where useful, distance. Finish at an easy pace.']}
result={e['id']:{'name':name,'instructions':recipes[e['pattern']]} for e,name in zip(base,names)}
(root/'dist/exercises-en.js').write_text('window.GYM_EXERCISES_EN = '+json.dumps(result,ensure_ascii=False,separators=(',',':'))+';\n')
print(len(result),'English exercise names and instructions')
