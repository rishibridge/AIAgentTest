from PIL import Image, ImageDraw, ImageFont

# Create a blank white image
img = Image.new('RGB', (800, 600), color=(255, 255, 255))
d = ImageDraw.Draw(img)

text = """
HOSPITAL DISCHARGE SUMMARY
Patient: John Doe
Date: Oct 25, 2023

DIAGNOSIS:
Acute myocardial infarction.

HOSPITAL COURSE:
Patient arrived via EMS with severe chest pain. 
ECG showed ST elevation. Patient was immediately 
taken to the cath lab. A stent was placed in the LAD.
Patient recovered well and is discharged on beta blockers.

NOTE: Patient reported an allergy to Aspirin during admission.
"""

d.text((50, 50), text, fill=(0, 0, 0))
img.save("medical_chart.png")
print("Saved medical_chart.png")
